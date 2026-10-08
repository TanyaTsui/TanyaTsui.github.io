/* ============================================================
   CALCULATION ENGINE (pure functions, no DOM)
   Must stay identical to build_data.py — the percentile is computed
   against scores that script precomputed for every land cell x radius.
   Check with ?selftest after changing anything here.
   ============================================================ */
const NCOLS = RASTER_DATA.grid.ncols;
const NROWS = RASTER_DATA.grid.nrows;
const PXX = RASTER_DATA.grid.pxX;   // meters per cell, x
const PXY = RASTER_DATA.grid.pxY;   // meters per cell, y
const MATERIAL_KEYS = Object.keys(RASTER_DATA.materials);
const MIN_DEMAND_T = SCORE_DIST.min_demand_t;   // t feedstock / yr the factory needs

/* ---------- decode (gzip base64 -> typed array) ---------- */
async function gunzipB64(b64){
  const byteChars = atob(b64);
  const bytes = new Uint8Array(byteChars.length);
  for(let i=0;i<byteChars.length;i++) bytes[i]=byteChars.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

let materialGrids = {};   // key -> Float64Array, tonnes/yr per cell
let cellTotals = null;    // Float64Array, all materials summed per cell
let landMask = null;      // Uint8Array, 1 = land

async function decodeAll(){
  await Promise.all(MATERIAL_KEYS.map(async k=>{
    const raw = new Int16Array(await gunzipB64(RASTER_DATA.materials[k]));
    const scale = RASTER_DATA.material_scales[k];
    const out = new Float64Array(raw.length);
    for(let i=0;i<raw.length;i++) out[i] = raw[i]>0 ? raw[i]*scale : 0;
    materialGrids[k] = out;
  }));
  landMask = new Uint8Array(await gunzipB64(RASTER_DATA.land_mask));
  cellTotals = new Float64Array(NCOLS*NROWS);
  MATERIAL_KEYS.forEach(k=>{
    const g = materialGrids[k];
    for(let i=0;i<g.length;i++) cellTotals[i] += g[i];
  });
}

/* ---------- site snapping ---------- */
// Snap a fractional grid position to the nearest land cell centre (searching a
// small ring outward for coastal clicks). Every chosen site is therefore one of
// the land cells enumerated by build_data.py.
function snapToLand(colF,rowF){
  const c0 = Math.round(colF), r0 = Math.round(rowF);
  for(let r=0;r<=6;r++){
    let best=null, bestD=Infinity;
    for(let dr=-r;dr<=r;dr++){
      for(let dc=-r;dc<=r;dc++){
        if(Math.max(Math.abs(dr),Math.abs(dc))!==r) continue;
        const cc=c0+dc, rr=r0+dr;
        if(cc<0||cc>=NCOLS||rr<0||rr>=NROWS) continue;
        if(!landMask[rr*NCOLS+cc]) continue;
        const d=(cc-colF)**2+(rr-rowF)**2;
        if(d<bestD){bestD=d; best={col:cc,row:rr};}
      }
    }
    if(best) return best;
  }
  return null;
}

/* ---------- catchment aggregation ---------- */
// Sums feedstock inside the travel-distance disc and the biomass-weighted mean
// straight-line distance from the site to that feedstock.
function aggregateMaterials(col,row,distKm){
  const radiusM = distKm*1000, r2 = radiusM*radiusM;
  const colR = Math.ceil(radiusM/PXX)+1;
  const rowR = Math.ceil(radiusM/PXY)+1;
  const totals = {};
  MATERIAL_KEYS.forEach(k=>totals[k]=0);
  let grand = 0, distSum = 0;
  for(let dr=-rowR;dr<=rowR;dr++){
    const rr=row+dr;
    if(rr<0||rr>=NROWS) continue;
    const dyM = dr*PXY;
    for(let dc=-colR;dc<=colR;dc++){
      const cc=col+dc;
      if(cc<0||cc>=NCOLS) continue;
      const dxM = dc*PXX;
      const d2 = dxM*dxM + dyM*dyM;
      if(d2 > r2) continue;
      const idx = rr*NCOLS+cc;
      const t = cellTotals[idx];
      if(t<=0) continue;
      MATERIAL_KEYS.forEach(k=>{ totals[k] += materialGrids[k][idx]; });
      grand += t;
      distSum += t*Math.sqrt(d2)/1000;
    }
  }
  return {totals, grand, meanDistKm: grand>0 ? distSum/grand : 0};
}

/* ---------- impacts (per kg printed product) ---------- */
function fabricationTotal(category){
  return Object.values(LCA_DATA.process_burdens).reduce((s,p)=>s+(p[category]?.score||0),0);
}

function transportTkmPerKg(meanDistKm){
  return TRANSPORT.feed_t_per_kg_product * TRANSPORT.road_detour * meanDistKm;
}

// Returns {category: {feedstock, transport, fabrication, avoided, net}} or null.
function computeImpacts(agg){
  if(!agg || agg.grand<=0) return null;
  const tkm = transportTkmPerKg(agg.meanDistKm);
  const out = {};
  CATEGORIES.forEach(c=>{
    let feedstock=0, avoided=0;
    MATERIAL_KEYS.forEach(k=>{
      const w = agg.totals[k]/agg.grand;
      const name = RASTER_DATA.material_display_names[k];
      feedstock += w*(LCA_DATA.material_burdens[name]?.[c]?.score||0);
      // signed: biogenic carbon storage is a credit for fast-growing materials
      // and a small penalty for slow-rotation forest materials (bark, wood flour)
      avoided += w*(LCA_DATA.benefits[name]?.[c]?.score||0);
    });
    const transport = tkm*TRANSPORT.per_tkm[c].score;
    const fabrication = fabricationTotal(c);
    out[c] = {feedstock, transport, fabrication, avoided, net: feedstock+transport+fabrication+avoided};
  });
  return out;
}

// Normalised, equal-weight single score in impact points (milli person-equivalents).
// Lower is better.
function computeScore(impacts){
  if(!impacts) return null;
  return CATEGORIES.reduce((s,c)=>s+impacts[c].net/EF_NORM[c],0)*1000;
}

function isFeasible(agg){
  return !!agg && agg.grand >= MIN_DEMAND_T;
}

// Share (0–100) of all feasible site x distance solutions that score worse
// than `score`, interpolated from the precomputed quantiles.
function percentileBeaten(score){
  const q = SCORE_DIST.quantiles, n = q.length-1;
  if(score<=q[0]) return 100;
  if(score>=q[n]) return 0;
  let lo=0, hi=n;
  while(hi-lo>1){
    const mid=(lo+hi)>>1;
    if(q[mid]<=score) lo=mid; else hi=mid;
  }
  const frac = (q[hi]-q[lo])>0 ? (score-q[lo])/(q[hi]-q[lo]) : 0;
  const below = (lo+frac)/n;          // share of solutions scoring better (lower)
  return (1-below)*100;
}

/* ---------- geography (display only) ---------- */
function gridToLatLonApprox(col,row){
  // Rough inverse of EPSG:3035 (LAEA Europe, lon0=10E, lat0=52N) on a sphere.
  // Close enough for a UI readout, not for analysis.
  const x = RASTER_DATA.grid.originX + col*PXX - 4321000;
  const y = (RASTER_DATA.grid.originY - row*PXY) - 3210000;
  const R = 6371000;
  const lat0 = 52*Math.PI/180, lon0 = 10*Math.PI/180;
  const rho = Math.sqrt(x*x+y*y);
  if(rho < 1){ return [52,10]; }
  const c = 2*Math.asin(Math.min(1,rho/(2*R)));
  const lat = Math.asin(Math.cos(c)*Math.sin(lat0) + (y*Math.sin(c)*Math.cos(lat0))/rho);
  const lon = lon0 + Math.atan2(x*Math.sin(c), rho*Math.cos(lat0)*Math.cos(c) - y*Math.sin(lat0)*Math.sin(c));
  return [lat*180/Math.PI, lon*180/Math.PI];
}

/* ---------- self-test (?selftest) ---------- */
function runSelfTest(){
  const rows = SCORE_DIST.spot_checks.map(chk=>{
    const agg = aggregateMaterials(chk.col, chk.row, chk.r);
    const score = computeScore(computeImpacts(agg));
    return {
      site: `${chk.col},${chk.row} @ ${chk.r} km`,
      supply_py: chk.supply, supply_js: +agg.grand.toFixed(3),
      dbar_py: chk.dbar, dbar_js: +agg.meanDistKm.toFixed(4),
      score_py: chk.score, score_js: +score.toFixed(6),
      ok: Math.abs(score-chk.score) < 1e-5 && Math.abs(agg.grand-chk.supply) < 0.01,
    };
  });
  console.table(rows);
  return rows.every(r=>r.ok);
}
