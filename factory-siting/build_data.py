"""
Regenerates the factory-siting game's data files:

    data/rasters.js     RASTER_DATA (feedstock grids + land mask) and COASTLINE
    data/lca.js         LCA_DATA (3 categories), TRANSPORT, EF_NORM, CATEGORIES
    data/score_dist.js  SCORE_DIST — score quantiles over every feasible
                        (land cell x travel distance) solution, for the percentile

Sources:
    _source/factory_siting_v1.html     the original single-file explorer (rasters, LCA scores)
    ../raw_impact_explorer/data.js     "Road transport" unit burdens (per tkm)

The scoring here MUST stay identical to calc.js (computeImpacts / computeScore).
Run `python3 build_data.py` after changing either, and compare the spot checks it
prints against the browser's `?selftest` console output.

Usage:
    python3 build_data.py [--min-demand 50000]
"""
import argparse
import base64
import gzip
import json
from pathlib import Path

import numpy as np
from scipy.signal import fftconvolve

HERE = Path(__file__).resolve().parent
SOURCE_HTML = HERE / "_source" / "factory_siting_v1.html"
RAW_DATA_JS = HERE.parent / "raw_impact_explorer" / "data.js"
OUT_DIR = HERE / "data"

CATEGORIES = ["climate change", "eutrophication: marine", "land use"]

# Global per-person normalisation factors, EF 3.1 (from the EF 3.1 reference
# package, https://eplca.jrc.ec.europa.eu/permalink/EF3_1/EF-v3.1.zip, as tabulated
# in GreenDelta's openLCA EF 3.1 import notes). raw_impact_explorer/build_data.py
# still carries the older EF 3.0 values (8.10e3 / 1.95e1 / 8.19e5).
EF_NORM = {
    "climate change": 7.553083162851e03,     # kg CO2-eq / person / yr
    "eutrophication: marine": 1.954518155192e01,  # kg N-eq / person / yr
    "land use": 8.194981829230e05,          # pt / person / yr
}

# Transport assumptions (mirrored in calc.js)
ROAD_DETOUR = 1.3          # road distance / straight-line distance
FEED_T_PER_KG_PRODUCT = 0.001  # 1 kg feedstock per kg printed product, in tonnes

# Scope is cradle-to-gate: processes after the factory gate are left out of
# fabrication even though the source LCA data includes them.
EXCLUDED_PROCESSES = {"On-site panel repair", "EoL: incineration"}

RADII_KM = list(range(10, 501, 10))  # must match the slider in index.html
N_QUANTILES = 1001

# Default factory demand (t feedstock / yr). Override with --min-demand.
DEFAULT_MIN_DEMAND_T = 50000


# ------------------------------------------------------------------ loading
def grab_const(lines, name):
    prefix = f"const {name}"
    for line in lines:
        if line.startswith(prefix):
            return json.loads(line[line.index("=") + 1:].strip().rstrip(";"))
    raise KeyError(name)


def decode_int16(b64, nrows, ncols):
    raw = gzip.decompress(base64.b64decode(b64))
    return np.frombuffer(raw, dtype="<i2").reshape(nrows, ncols)


def encode_uint8(arr):
    return base64.b64encode(gzip.compress(arr.astype(np.uint8).tobytes(), mtime=0)).decode()


def load_transport():
    s = RAW_DATA_JS.read_text(encoding="utf-8")
    d = json.loads(s[s.index("{"):].rstrip().rstrip(";"))
    out = {}
    for r in d["unitBurdens"]:
        if r["m"] == "Road transport" and r.get("scn", "baseline") == "baseline" and r["cat"] in CATEGORIES:
            out[r["cat"]] = {"score": r["score"], "unit": r["unit"] + "/tkm"}
    missing = set(CATEGORIES) - set(out)
    if missing:
        raise ValueError(f"Road transport missing categories: {missing}")
    return out


# ------------------------------------------------------------------ model
def build_lca(lca_src, transport):
    """Trim to 3 categories and drop post-gate processes.

    'benefits' are kept as signed values: mostly biogenic carbon storage credits
    (Guest et al. 2013 GWPbio, 25-yr storage), which are positive (a carbon-debt
    penalty) for slow-rotation forest materials such as bark and wood flour."""
    lca = {"material_burdens": {}, "benefits": {}, "process_burdens": {}}
    for sec in lca:
        for name, cats in lca_src[sec].items():
            if sec == "process_burdens" and name in EXCLUDED_PROCESSES:
                continue
            lca[sec][name] = {}
            for c in CATEGORIES:
                lca[sec][name][c] = {"score": cats[c]["score"], "unit": cats[c]["unit"]}
    units = {c: lca["material_burdens"][next(iter(lca["material_burdens"]))][c]["unit"] for c in CATEGORIES}
    return lca, units


def material_coeffs(lca, display_names, keys):
    """Per-material (burden + avoided) per category, shape (n_materials, n_categories)."""
    return np.array([
        [lca["material_burdens"][display_names[k]][c]["score"] + lca["benefits"][display_names[k]][c]["score"]
         for c in CATEGORIES]
        for k in keys
    ])


def fabrication_totals(lca):
    return np.array([sum(p[c]["score"] for p in lca["process_burdens"].values()) for c in CATEGORIES])


def disc_kernels(radius_km, pxx, pxy):
    r_m = radius_km * 1000.0
    hc = int(np.ceil(r_m / pxx)) + 1
    hr = int(np.ceil(r_m / pxy)) + 1
    dx = np.arange(-hc, hc + 1) * pxx
    dy = np.arange(-hr, hr + 1) * pxy
    DX, DY = np.meshgrid(dx, dy)
    d2 = DX * DX + DY * DY
    inside = (d2 <= r_m * r_m).astype(float)
    dist_km = np.sqrt(d2) / 1000.0 * inside
    return inside, dist_km


def score_from(net):
    """net: (..., n_categories) -> normalised equal-weight score (x1000 = impact points)."""
    norm = np.array([EF_NORM[c] for c in CATEGORIES])
    return (net / norm).sum(axis=-1) * 1000.0


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-demand", type=float, default=DEFAULT_MIN_DEMAND_T)
    args = ap.parse_args()
    min_demand = args.min_demand

    lines = SOURCE_HTML.read_text(encoding="utf-8").split("\n")
    raster = grab_const(lines, "RASTER_DATA")
    coastline = grab_const(lines, "COASTLINE")
    lca_src = grab_const(lines, "LCA_DATA")
    transport = load_transport()
    lca, units = build_lca(lca_src, transport)

    g = raster["grid"]
    nr, nc, pxx, pxy = g["nrows"], g["ncols"], g["pxX"], g["pxY"]
    keys = list(raster["materials"].keys())
    names = raster["material_display_names"]

    grids = []
    for k in keys:
        a = decode_int16(raster["materials"][k], nr, nc).astype(float)
        a[a < 0] = 0
        grids.append(a * raster["material_scales"][k])
    grids = np.stack(grids)               # (M, nr, nc) tonnes / yr
    total_grid = grids.sum(axis=0)
    land = decode_int16(raster["climate"]["temp_jan"], nr, nc) != -32768

    coeff = material_coeffs(lca, names, keys)           # (M, C)
    fab = fabrication_totals(lca)                      # (C,)
    tr = np.array([transport[c]["score"] for c in CATEGORIES])  # (C,) per tkm

    # ---- enumerate every (land cell, radius) solution
    all_scores, supply_150 = [], None
    n_total = 0
    for r in RADII_KM:
        inside, dist = disc_kernels(r, pxx, pxy)
        sums = np.stack([fftconvolve(gm, inside, mode="same") for gm in grids])  # (M, nr, nc)
        sums[sums < 0] = 0
        grand = sums.sum(axis=0)
        dsum = fftconvolve(total_grid, dist, mode="same")
        with np.errstate(invalid="ignore", divide="ignore"):
            dbar = np.where(grand > 1e-9, dsum / grand, 0.0)
            w = np.where(grand > 1e-9, sums / grand, 0.0)              # (M, nr, nc)
        mat = np.einsum("mrc,mk->rck", w, coeff)                         # (nr, nc, C)
        net = mat + fab + (FEED_T_PER_KG_PRODUCT * ROAD_DETOUR * dbar)[..., None] * tr
        score = score_from(net)
        feasible = land & (grand >= min_demand)
        n_total += land.sum()
        all_scores.append(score[feasible])
        if r == 150:
            supply_150 = grand[land]
    all_scores = np.concatenate(all_scores)

    print(f"Land cells: {land.sum()}, radii: {len(RADII_KM)}, solutions: {n_total}")
    print(f"Supply at 150 km over land cells (t/yr) percentiles 5/25/50/75/95: "
          f"{np.percentile(supply_150, [5, 25, 50, 75, 95]).round(0)}")
    print(f"Min demand {min_demand:.0f} t/yr -> feasible solutions: {len(all_scores)} "
          f"({len(all_scores) / n_total * 100:.1f}%)")
    print(f"Score (impact points) min/median/max: {all_scores.min():.4f} / "
          f"{np.median(all_scores):.4f} / {all_scores.max():.4f}")

    quantiles = np.quantile(all_scores, np.linspace(0, 1, N_QUANTILES))

    # ---- spot checks (compare with ?selftest in the browser)
    checks = []
    for (col, row, r) in [(200, 200, 150), (250, 150, 300), (150, 300, 50), (300, 120, 100)]:
        inside, dist = disc_kernels(r, pxx, pxy)
        hr_, hc_ = inside.shape[0] // 2, inside.shape[1] // 2
        sums = np.zeros(len(keys)); dsum = 0.0
        for i in range(-hr_, hr_ + 1):
            for j in range(-hc_, hc_ + 1):
                rr, cc = row + i, col + j
                if 0 <= rr < nr and 0 <= cc < nc and inside[i + hr_, j + hc_]:
                    sums += grids[:, rr, cc]
                    dsum += total_grid[rr, cc] * dist[i + hr_, j + hc_]
        grand = sums.sum()
        if grand <= 0:
            continue
        net = (sums / grand) @ coeff + fab + FEED_T_PER_KG_PRODUCT * ROAD_DETOUR * (dsum / grand) * tr
        checks.append({"col": col, "row": row, "r": r, "supply": round(float(grand), 3),
                       "dbar": round(float(dsum / grand), 4), "score": round(float(score_from(net)), 6)})
    print("Spot checks (col,row,r -> supply, dbar, score):")
    for c in checks:
        print("  ", c)

    # ---- write data files
    OUT_DIR.mkdir(exist_ok=True)
    raster_out = {
        "grid": g,
        "materials": raster["materials"],
        "material_scales": raster["material_scales"],
        "material_display_names": names,
        "land_mask": encode_uint8(land),
    }
    header = "// Auto-generated by build_data.py — do not edit by hand.\n"
    (OUT_DIR / "rasters.js").write_text(
        header + "const RASTER_DATA = " + json.dumps(raster_out) + ";\n"
        + "const COASTLINE = " + json.dumps(coastline, separators=(",", ":")) + ";\n",
        encoding="utf-8")
    (OUT_DIR / "lca.js").write_text(
        header
        + "const CATEGORIES = " + json.dumps(CATEGORIES) + ";\n"
        + "const CATEGORY_UNITS = " + json.dumps(units) + ";\n"
        + "const LCA_DATA = " + json.dumps(lca) + ";\n"
        + "const TRANSPORT = " + json.dumps({
            "per_tkm": transport,
            "road_detour": ROAD_DETOUR,
            "feed_t_per_kg_product": FEED_T_PER_KG_PRODUCT,
            "source": "raw_impact_explorer/data.js — Road transport (RER), baseline",
        }) + ";\n"
        + "const EF_NORM = " + json.dumps(EF_NORM) + ";\n",
        encoding="utf-8")
    (OUT_DIR / "score_dist.js").write_text(
        header + "const SCORE_DIST = " + json.dumps({
            "min_demand_t": min_demand,
            "radii_km": RADII_KM,
            "n_solutions": int(n_total),
            "n_feasible": int(len(all_scores)),
            "quantiles": [round(float(q), 6) for q in quantiles],
            "spot_checks": checks,
        }) + ";\n",
        encoding="utf-8")
    for f in ("rasters.js", "lca.js", "score_dist.js"):
        print(f"Wrote data/{f} ({(OUT_DIR / f).stat().st_size / 1024:.0f} kB)")


if __name__ == "__main__":
    main()
