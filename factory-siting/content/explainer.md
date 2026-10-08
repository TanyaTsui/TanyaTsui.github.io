# Explainer page: content

Text for the explainer shown after the game (reached from the result screen, and linked from the welcome page).
Same tone as `welcome.md`: plain language, short lines, readable on an exhibition screen. One scrolling page.

## Notes for implementation

- One single scrolling page with the three sections below, and a button at the end to go back to the start (or to the map).
- Reuse the category colours from `app.js` (`CATEGORY_COLORS`): climate change `#A8432B`, marine eutrophication `#3E6FA0`, land use `#6B7A3A`.
- Section 3 includes an animation, `europe_tour.gif`, showing the material availability maps. **This file still has to be copied into the project** (suggested path: `assets/europe_tour.gif`). Until then, leave a placeholder box with a caption.
- Items in [square brackets] are notes or placeholders, not display text, **except** the `[FIX n: ...]` markers described below.
- The gif lives in Tanya's project `lca_for_adaptive_factories/results/figures/europe_tour.gif`, which is outside the folders connected to this session. Tanya will copy it to `assets/europe_tour.gif` in this folder. Reference that path, and show the placeholder box with the caption if the file is missing.

### REQUIRED: highlight the unresolved issues on the page

Some statements in this text are known to be inconsistent with the model or unverified. Tanya will fix them later, so they must be **impossible to miss** while she reviews the page. When building the explainer page:

1. Wrap every passage tagged `[FIX n]` in the text (n = 1 to 5, listed in "Fixes needed" at the end of this file) in a visible highlight: yellow background (`#FFE066`), a dashed dark outline, and a small badge reading `FIX n` at the start of the passage.
2. Add a `title` tooltip on each highlight with the one-line description of that fix from the list at the end of this file.
3. Show the highlights **only in review mode**: when the page URL has `?review` (same pattern as the existing `?selftest`). Without it, render the text normally, with no badges. Do not remove the markers from the source.
4. In review mode, also show a fixed panel (top-right, collapsible) listing all five fixes with links that scroll to each highlight.
5. Keep the text of each `[FIX n]` passage exactly as written until Tanya asks for a change. Do not silently "correct" it.
6. Put the fix markers in one place in the code (e.g. a `data-fix="n"` attribute on the element), so they are easy to find and remove later.

---

## Section 1: How your score is made

# How was your score calculated?

Every possible factory location in Europe has a different mix of materials nearby, so each one has a different environmental impact. We worked out that impact for every location and every catchment size, using a method called **life cycle assessment**. Your score shows how your choice compares with all of them.

The next sections explain the method and where the numbers come from.

---

## Section 2: Environmental impact modelling

# Measuring environmental impact with life cycle assessment

## What is counted

Life cycle assessment (LCA) adds up the environmental impacts of everything needed to make a product, from the ground up. Here we count the impacts of making **1 kg of 3D-printed biopolymer**:

1. **Growing or extracting the materials.** Crops need land and fertiliser. Wood and paper residues carry a share of the impact of the industry they came from. Seagrass has to be harvested.
2. **Transport.** Trucks carry the materials from the catchment area to the factory. The further away they are, the higher the impact.
3. **Making the biopolymer.** Mixing the ingredients, 3D printing, drying and baking. This is the same everywhere in the game.

This kind of study is called **cradle-to-gate**: it follows the material from its origin to the factory gate. It stops there. It does not include how a finished product is used, repaired, or disposed of.

## Three impact categories

LCA can measure many types of environmental impact. The European method we use, the **Environmental Footprint (EF 3.1)** (European Commission, 2021; Andreasi Bassi et al., 2023), defines 16 of them, including acidification, ozone depletion and water use. To keep the game clear, we picked three:

- **Climate change:** greenhouse gases, measured in kg CO₂-equivalent.
- **Marine eutrophication:** nutrients such as nitrogen washing into the sea, where they cause algal blooms and oxygen-poor water. Measured in kg nitrogen-equivalent.
- **Land use:** how much farming and forestry reduce the quality of the soil, measured with a soil quality index.

## Turning three numbers into one score

The three categories use different units, so they can't be added directly. We use the EF 3.1 **normalisation factors** to make them comparable (Andreasi Bassi et al., 2023).

A normalisation factor is the total yearly impact of an average European in that category. Dividing your impact by it tells you how large your impact is **compared with one person's yearly footprint**:

| Category | Average European, per year |
|---|---|
| Climate change | 7,553 kg CO₂-eq |
| Marine eutrophication | 19.5 kg N-eq |
| Land use | 819,500 soil-quality points |

For example, 1 kg CO₂-eq is 1/7,553 of an average European's yearly climate footprint. After normalising, the three categories are on the same scale. We then add them with equal weight and multiply by 1,000. The unit is **impact points**: one point is a thousandth of an average European's yearly footprint.

**Lower is better.** Your percentile shows what share of all possible location and catchment combinations scored worse than yours.

## Benefits: stored carbon

Not everything in an LCA is a burden. Plants take CO₂ from the air as they grow. When that carbon ends up in a long-lasting product, it stays out of the atmosphere for as long as the product lasts. This can count as a **benefit**: a credit that lowers the climate change score.

We use an LCA accounting method that credits the carbon sequestration of bio-based products, developed by Guest et al. (2013). It takes two things into account:

- **Rotation period:** how long the plant takes to grow back and take the carbon up again. Crops regrow within a year. Forests take decades.
- **Storage period:** how long the carbon stays locked in the product before it returns to the air. In the game, we assume 25 years.

Fast-growing materials, such as cotton, hemp and peas, earn a credit. So do waste materials such as cellulose and seagrass, because their carbon is released 25 years later than it otherwise would be. Materials from slow-growing forests, such as bark and wood flour, get a small **penalty** instead: 25 years of storage doesn't make up for the decades the forest needs to grow back.

In the game, these credits and penalties are weighted by how much of each material is in your factory's mix, and they show up as the "Avoided" bar.

Want to know more? See the [carbon sequestration accounting explainer](https://tanyatsui.github.io/carbon-sequestration-explainer/).

*This is a simplified estimate, not a full LCA.*

---

## Section 3: Where the data comes from

# Where the numbers come from

## Impacts: ecoinvent

Most of the impact data comes from **ecoinvent**, the world's most widely used database of life cycle inventories. It contains thousands of industrial and agricultural processes, each with its inputs, emissions and resource use. We used version 3.12 (ecoinvent, 2025; Wernet et al., 2016).

For each material, we used the closest match:

| Material | Impact data |
|---|---|
| Bark | ecoinvent: bark chips. The milling step that turns chips into flour is not yet included. |
| Wood flour | ecoinvent: sawdust from wood processing |
| Cellulose | ecoinvent: cellulose fibre |
| Hemp dust | ecoinvent: hemp carding waste, a by-product of hemp fibre processing |
| Cotton | ecoinvent: seed-cotton (raw, unprocessed cotton) |
| Pea protein | Our own inventory, based on a RAW project workshop, using ecoinvent for background processes |
| Seagrass | A life cycle assessment by a RAW project partner |

Learn more: [ecoinvent.org](https://ecoinvent.org)

The impacts are calculated with the EF 3.1 method. More about it: [Environmental Footprint (European Commission)](https://eplca.jrc.ec.europa.eu/EnvironmentalFootprint.html)

## Material availability: our own maps

Ecoinvent tells us how much each material costs the environment. It doesn't tell us **where** the material is available. There was no ready-made map of that, so we built one.

For each of the seven materials we estimated how many tonnes are produced each year in each 10 × 10 km square of Europe. Each kind of material needed its own approach:

- **Crops (peas, cotton, hemp dust).** National and regional harvest statistics from Eurostat, spread over the places where each crop is grown using the SPAM crop maps (Eurostat, 2025a; IFPRI, 2024). Hemp dust is a by-product of processing hemp fibre: about 5% of the hemp harvest (Zampori et al., 2013).
- **Forest residues (bark, wood flour).** The amount of residue from sawmills and other wood industries, estimated by the S2BIOM project, spread over Europe's forests using the EFI forest map (S2BIOM, n.d.; European Forest Institute, n.d.). For countries S2BIOM doesn't cover, such as Norway and Switzerland, we used yield estimates from the literature.
- **Cellulose.** Fibres rejected by paper mills, estimated from paper production statistics and the locations of paper mills (Eurostat, 2025b; Spatial Finance Initiative, 2025).
- **Seagrass.** Maps of seagrass meadows, combined with measurements of how fast seagrass grows and an estimate of how much of it washes out of the meadows (EMODnet Seabed Habitats, 2025; Strydom et al., 2023; Cebrián & Duarte, 2001).

[Embed: `assets/europe_tour.gif`. Caption: "A tour of Europe: the materials available within 500 km of different locations. Darker means more tonnes per year."]

When you choose a location and a catchment area, the game adds up everything inside the circle and works out the mix of materials your factory could use.

## Simplifications

- Materials travel in a straight line to the factory, plus 30% to account for real roads.
- Every factory uses the same equipment and the same process everywhere.
- The factory needs at least 50,000 tonnes of materials per year within its catchment.

[Button: Play again]

---

## References

*[Shown as a separate section at the end of the page, after the Play again button.]*

- Andreasi Bassi, S., Biganzoli, F., Ferrara, N., Amadei, A., Valente, A., Sala, S., & Ardente, F. (2023). *Updated characterisation and normalisation factors for the Environmental Footprint 3.1 method* (EUR 31414 EN). Publications Office of the European Union. https://doi.org/10.2760/798894
- Cebrián, J., & Duarte, C. M. (2001). Detrital stocks and dynamics of the seagrass *Posidonia oceanica* (L.) Delile in the Spanish Mediterranean. *Aquatic Botany*, 70(4), 295–309. https://doi.org/10.1016/S0304-3770(01)00154-1
- ecoinvent. (2025). *ecoinvent database, version 3.12*. ecoinvent Association, Zurich. https://ecoinvent.org
- EMODnet Seabed Habitats. (2025). *Seagrass cover in Europe* [Dataset]. https://gis.ices.dk/geonetwork/srv/api/records/39746d9c-4220-425c-bc26-7cb3056c36a5
- European Commission. (2021). Commission Recommendation (EU) 2021/2279 of 15 December 2021 on the use of the Environmental Footprint methods to measure and communicate the life cycle environmental performance of products and organisations. *Official Journal of the European Union*, L 471, 1–396. https://eur-lex.europa.eu/eli/reco/2021/2279/oj
- European Forest Institute. (n.d.). *Forest map of Europe* [Dataset]. https://efi.int/knowledge/maps/forest
- Eurostat. (2025a). *Crop production in EU standard humidity* (apro_cpsh1) [Dataset]. https://ec.europa.eu/eurostat/databrowser/view/apro_cpsh1/default/table
- Eurostat. (2025b). *Paper and paperboard production statistics* (for_pp) [Dataset]. https://ec.europa.eu/eurostat/databrowser/view/for_pp/default/table
- Guest, G., Cherubini, F., & Strømman, A. H. (2013). Global warming potential of carbon dioxide emissions from biomass stored in the anthroposphere and used for bioenergy at end of life. *Journal of Industrial Ecology*, 17(1), 20–30. https://doi.org/10.1111/j.1530-9290.2012.00507.x
- International Food Policy Research Institute (IFPRI). (2024). *Global spatially-disaggregated crop production statistics data for 2020, version 2.0* (SPAM 2020) [Dataset]. https://www.mapspam.info/data/
- S2BIOM. (n.d.). *Biomass cost-supply data* [Dataset]. https://s2biom.wenr.wur.nl/web/guest/data-downloads
- Spatial Finance Initiative. (2025). *GeoAsset pulp and paper database* [Dataset]. https://cgfi.ac.uk/spatial-finance-initiative/geoasset-project/pulp-and-paper-database/
- Strydom, S., McCallum, R., Lafratta, A., Webster, C. L., O'Dea, C. M., Said, N. E., … Serrano, O. (2023). Global dataset on seagrass meadow structure, biomass and production. *Earth System Science Data*, 15(1), 511–519. https://doi.org/10.5194/essd-15-511-2023
- Wernet, G., Bauer, C., Steubing, B., Reinhard, J., Moreno-Ruiz, E., & Weidema, B. (2016). The ecoinvent database version 3 (part I): overview and methodology. *The International Journal of Life Cycle Assessment*, 21(9), 1218–1230. https://doi.org/10.1007/s11367-016-1087-8
- Zampori, L., Dotelli, G., & Vernelli, V. (2013). Life cycle assessment of hemp cultivation and use of hemp-based thermal insulator materials in buildings. *Environmental Science & Technology*, 47(13), 7413–7420. https://doi.org/10.1021/es401326a

---

## Fixes needed (for Tanya, to resolve later with Claude Code)

Each item below is tagged `[FIX n]` in the text above and must be highlighted in review mode (see "REQUIRED" at the top).

1. **FIX 1 (resolved 2026-10-08): Scope contradiction.** Resolved by excluding "On-site panel repair" and "EoL: incineration" from fabrication (`EXCLUDED_PROCESSES` in `build_data.py`); the text stands as written. The text says the study is cradle-to-gate (no use, repair or end of life), as briefed. But the game's fabrication step (`data/lca.js`, `process_burdens`) includes "EoL: incineration" and "On-site panel repair", so the model does count some later stages. Resolve by either changing the text or changing the model (`build_data.py`, `calc.js`).
2. **FIX 2 (resolved 2026-10-08): Climate change normalisation factor.** Confirmed: 8.10e3 was the EF 3.0 value. Switched all three factors to EF 3.1 (climate change 7,553.08, marine eutrophication 19.545, land use 819,498 per person; source: EF 3.1 reference package as tabulated in GreenDelta's openLCA EF 3.1 import notes), rebuilt `data/`, and updated the table and the "1/7,553" example. `build_data.py` uses 8.10e3 kg CO₂-eq per person and labels it EF 3.1. As far as I know, 8.10e3 is the EF 3.0 value and EF 3.1 uses a lower one. Check against the official EF 3.1 table. If it changes, update `build_data.py`, regenerate `data/` (including `score_dist.js`), and update this table.
3. **FIX 3 (resolved 2026-10-08): Number of EF categories.** Confirmed: EF 3.1 has 16 impact categories; the 25 in the data include sub-indicators (e.g. climate change fossil/biogenic/land use change). Text kept as written. The text says EF 3.1 has 16. The repo mentions 25 categories in the data, which includes sub-categories (fossil, biogenic, land use change). Check the number and wording.
4. **FIX 4 (resolved 2026-10-08): Avoided burdens description.** The credits were reconstructed as Guest et al. (2013) GWPbio carbon storage credits with a 25-year storage period (delayed-emission credits for cellulose and seagrass); pea protein additionally has a small credit in all categories, likely avoided co-production (not mentioned in the text; tiny outside climate change). Per Tanya: keep them (option B) and stop clamping positive values, so bark and wood flour now carry their carbon-debt penalty. Section rewritten; reference corrected to Guest, Cherubini & Strømman 2013, JIE 17(1) 20–30. The wording is general. The repo documents carbon storage plus end-of-life credits for the full RAW model, but the game's credits (`benefits` in `data/lca.js`) come from an older notebook model. They are mostly climate change; only pea protein also has a land-use credit; bark and wood flour have none. Check what the numbers represent, and rewrite the section to match.
5. **FIX 5 (resolved 2026-10-08): Material availability data.** Rewritten per material group from "Biopolymer ingredient information.xlsx" (sheet "spatial data overview"). Climate data removed (no longer used by the game); the by-product assumption for bark and wood flour corrected (S2BIOM wood-industry residues on the EFI forest map, not timber harvest volumes). Remaining uncertainties split out as FIX 6–8. The repo does not document the yield mapping, so this paragraph is based on project notes (sources include S2BIOM, SPAM, Eurostat, IIASA forest management raster, EMODnet seagrass polygons, WorldClim). Correct which sources feed which material, and check the by-product assumption for bark and wood flour.
6. **FIX 6 (resolved 2026-10-08): Forest residues outside S2BIOM coverage.** Confirmed by Tanya; text kept. The spreadsheet says "S2BIOM or literature yields, depending on data availability". Confirm literature yields were used for countries S2BIOM doesn't cover (Norway, Switzerland, Belarus, Russia).
7. **FIX 7 (resolved 2026-10-08): Cellulose map method.** Method details not documented; per Tanya, the text was made deliberately general ("estimated from paper production statistics and the locations of paper mills"). Inferred from the spreadsheet: Eurostat national paper production placed at SFI paper-mill locations, times a reject factor from the literature. The SFI capacity data was noted as rejected (low coverage), so confirm how production was distributed over mills, and which reject factor was used (add its source to the references).
8. **FIX 8 (resolved 2026-10-08): Impact data for pea protein and seagrass.** Per Tanya: the spreadsheet is outdated; assume the current model is right. Table kept as written. The spreadsheet lists both LCAs as still pending (workshop inventory awaiting confirmation; partner LCA not yet received). Confirm which data the game's numbers (from the older notebook) actually use, and adjust the table.
