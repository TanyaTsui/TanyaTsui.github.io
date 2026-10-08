# Factory siting game

Exhibition version of the RAW factory-siting explorer. Visitors click a site in
Europe, set how far feedstock may travel, see the impacts per kg of 3D-printed biopolymer (in EU-normalised impact points),
then lock in their choice. They get a percentile (how many of all possible
site × distance combinations theirs beats) and an entry on a shared leaderboard.

## Files

- `index.html`: welcome page (text from `content/welcome.md`), with a Start button that opens the game. It prefetches the game's files so Start opens quickly.
- `play.html`: the game page (shell and styles). The result screen links to the explainer.
- `explainer.html`: how the score is calculated (text from `content/explainer.md`). Open it with `?review` to highlight the passages still marked `[FIX n]` (yellow, with a list panel top-right). The markers are `data-fix="n"` attributes, and their one-line descriptions are in the `FIXES` object at the bottom of the page.
- `pages.css`: shared styles for the welcome page and the explainer
- `assets/europe_tour.gif`: material availability animation for the explainer (copied from `lca_for_adaptive_factories/results/figures/`; 2.7 MB, lazy-loaded)
- `content/`: source text for the welcome page and the explainer
- `calc.js`: calculation engine (pure functions, no DOM). **Must match `build_data.py`.**
- `app.js`: map, panels, choose dialog, leaderboard rendering
- `leaderboard.js`: leaderboard storage (Google Sheet, or local mode). Set `LEADERBOARD_URL` here.
- `apps_script.gs`: Google Apps Script backend for the Sheet
- `data/rasters.js`: feedstock grids (7 materials, t/yr per ~10 km cell), land mask, coastline
- `data/lca.js`: unit impacts for the 3 categories, the transport factor, and the normalisation factors
- `data/score_dist.js`: precomputed score quantiles for the percentile
- `build_data.py`: regenerates everything in `data/`
- `_source/factory_siting_v1.html`: the original single-file explorer, which is the source of the rasters and LCA scores

No build step is needed at runtime. The page works from `file://` and on GitHub Pages.

## Model (per kg 3D-printed biopolymer)

For climate change, marine eutrophication and land use:

| Term | How |
|---|---|
| Feedstock | Burden of each material, weighted by its share of feedstock in the catchment |
| Transport | 1 kg feedstock/kg biopolymer × biomass-weighted mean straight-line distance × 1.3 road detour × road freight impact per tkm (`raw_impact_explorer` "Road transport", RER, baseline) |
| Fabrication | Mix prep + 3D printing + drying + kiln baking. Fixed values, the same everywhere (drying at the 20 °C / 80 % RH baseline). Cradle-to-gate: the source data's "On-site panel repair" and "EoL: incineration" are excluded (`EXCLUDED_PROCESSES` in `build_data.py`) |
| Avoided | Biogenic carbon storage credits per material (Guest et al. 2013 GWPbio, rotation period × 25-year storage), weighted by mix. Signed: slow-rotation forest materials (bark, wood flour) carry a small penalty. Pea protein also has a small credit in all categories |
| Net | Sum of the above |

**Score** = Σ net / EF 3.1 global per-person normalisation factor × 1000, with the three categories weighted equally. The unit is "impact points" (thousandths of an average European's yearly footprint); lower is better. The page shows every bar in these points on one shared scale, so the three Net bars add up to the score shown under them. The percentile is revealed only after a visitor chooses.

**Supply rule:** the catchment must hold at least `min_demand_t` (default 50 kt/yr) of feedstock, or the location can't be chosen. Visitor clicks snap to the nearest land cell, so every choice is one of the solutions that were enumerated.

## Percentile

`build_data.py` scores every land cell (82k) at every slider distance (10–500 km, step 10). That is 4.1 M solutions, of which 3.35 M meet the supply rule. Disc sums are computed as FFT convolutions, so the build takes about 20 s. Only 1001 quantiles are shipped, and the browser interpolates between them.

After changing the model, demand or LCA data:

```
python3 build_data.py                    # default demand 50 000 t/yr
python3 build_data.py --min-demand 20000 # different demand
```

Then open `play.html?selftest` and check that the browser console reports **Self-test PASSED**. This compares the browser's scores with Python's at four spot checks.

## Leaderboard setup (Google Sheet)

1. Create a new Google Sheet. Keep it separate from the RAW research log.
2. Go to Extensions → Apps Script, replace the code with the contents of `apps_script.gs`, and save.
3. Deploy → New deployment → Web app: execute as **Me**, access **Anyone**. Copy the `…/exec` URL.
4. Paste the URL into `LEADERBOARD_URL` in `leaderboard.js`.
5. Submit one entry from the page. A header row and your entry should appear in the Sheet.

Notes:
- **Moderation:** put `TRUE` (or tick a checkbox) in the `hidden` column to remove an entry from the public board. Deleting the row also works.
- The script stores names and reasons as plain text, capped at 30 and 200 characters. Text that starts with `=`, `+`, `-` or `@` is never treated as a formula. The page escapes all text before display.
- POSTs are `no-cors`, so the page can't confirm that an entry arrived. It shows the new entry immediately and keeps it until the Sheet returns it.
- If you redeploy the script as a *new deployment*, the URL changes. Use "Manage deployments → Edit" to keep the same URL.
- While `LEADERBOARD_URL` is empty, the page runs in **local mode**: entries are kept in this browser only. This is useful for testing, or for a single offline kiosk.

## Exhibition setup (full screen)

The browser's own full-screen mode stays on when visitors move between the three pages; a page's "full screen" button would not (it switches off on every page change), so there isn't one.

- **Laptop/PC kiosk (recommended):** start Chrome in kiosk mode, which hides all browser UI and can't be exited with a click:
  - macOS: `open -na "Google Chrome" --args --kiosk "https://tanyatsui.github.io/factory-siting/"` (quit with Cmd+Q)
  - Windows: `chrome.exe --kiosk https://tanyatsui.github.io/factory-siting/` (quit with Alt+F4)
- **Quick full screen:** F11 (Windows) or Ctrl+Cmd+F (macOS) in Chrome.
- **Tablet:** the site is installable (`manifest.webmanifest`, `display: fullscreen`). iPad: Safari → Share → Add to Home Screen, then open it from the home screen (no browser bars); add Guided Access (Settings → Accessibility) to lock the tablet to it. Android: Chrome → menu → Install app.

**Exhibition mode** (`kiosk.js`): when the site runs full screen, links that would leave the exhibition are hidden (the "Tanya Tsui" link, the footer) or turned into plain text (ecoinvent, EF and reference links, the GIF's full-size link). Only the Introduction / The game / How it works navigation stays clickable. It switches on automatically when the page fills the whole screen (F11, `--kiosk`, installed app, or macOS full screen with View → "Always Show Toolbar in Full Screen" unticked). To force it on for a machine regardless, open `https://tanyatsui.github.io/factory-siting/?kiosk` once (remembered in that browser); `?kiosk=off` undoes it.

## Not built yet

- Kiosk idle reset
- Profanity filter (moderation is via the `hidden` column)
