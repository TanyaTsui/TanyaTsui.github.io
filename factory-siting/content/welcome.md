# Welcome page: content

Text for the single scrolling welcome page of the factory-siting exhibition game. Shown before the map tool.
Tone: light, game-like, readable at a glance on an exhibition screen (large type, short lines).

## Notes for implementation

- One single scrolling page (no separate screens or pagination), with three stacked sections that follow each other, ending in a **Start** button that opens the existing map tool.
- Reuse the existing colours from `app.js`:
  - Materials (`MATERIAL_COLOR_HEX`): bark `#8B5A2B`, cellulose `#C9A227`, cotton `#D8CBAE`, hemp dust `#6B7A3A`, peas `#7A9B57`, wood flour (key `sawdust`) `#A9743B`, seagrass `#2F6E5E`.
  - Impact categories (`CATEGORY_COLORS`): climate change `#A8432B`, marine eutrophication `#3E6FA0`, land use `#6B7A3A`.
- Use the same material display names as the tool (`material_display_names` in `data/rasters.js`), but drop the " filler" / " binder" suffix in the table; the role goes in its own column or tag.
- In the materials section, show the materials as three grouped cards/rows, each material with its colour swatch.
- Category dots in the mission section use the category colours above.
- Text in **bold** is emphasis. Text in *[italics in brackets]* is a note, not display text.

---

## Section 1: What we're making

# Where should you build a biopolymer factory?

In the RAW project, we are developing 3D-printed products made from biopolymer. It can be made from many different bio-based materials.

That means we can use whatever is available close to where we print: industrial waste, wild-harvested plants, or crops.

---

## Section 2: Every material has a different footprint

Some materials are leftovers that would otherwise go to waste. Others have to be grown or harvested first. Each one affects the environment in its own way, for better and for worse.

These are the materials we are working with:

### Industrial waste
*Leftovers from other industries*

| Material | Role | Comes from |
|---|---|---|
| Bark | filler | forestry and wood industry |
| Wood flour | filler | sawmills and wood processing |
| Cellulose | filler | paper industry |
| Hemp dust | filler | hemp fibre processing |

### Wild-harvested plants
*Gathered from nature*

| Material | Role | Comes from |
|---|---|---|
| Seagrass | filler | coastal seagrass meadows |

### Crops
*Grown on farmland*

| Material | Role | Comes from |
|---|---|---|
| Cotton | filler | cotton fields |
| Pea protein | binder | pea crops |

The fillers give the material its bulk. The pea protein holds it together.

**Why this matters:** you can't buy the same mix everywhere. Forests, farms, paper mills and coastlines are spread unevenly across Europe, so the place you print decides which materials you can get. The location of the factory changes its environmental impact.

---

## Section 3: Your mission

# Your mission

Pick the best location for a biopolymer factory in Europe. Then set the catchment area: how far the factory is allowed to collect materials from. Your goal is the **lowest environmental impact**.

A factory needs enough material nearby. If the catchment is too small, it can't run.

**Watch out for trade-offs.** We measure three impact categories:

- [dot: climate change colour] **Climate change**
- [dot: marine eutrophication colour] **Marine eutrophication** (nutrient pollution of the sea)
- [dot: land use colour] **Land use**

A location can be great for one and poor for another. Your three results are normalised and added into a single score, and that score ranks your choice against every other possible location. Lower is better.

You'll find out how you did once you lock in your choice.

*Curious how the score works? See the explainer afterwards.*

**[ Start ]**

---

## Open items

- The explainer text will be added in a separate file (`content/explainer.md`).
- The original brief listed four source types. "Agricultural waste" is dropped because none of the seven current materials fit it. If one is added later, add a fourth group.
- Hemp dust is grouped under industrial waste (a by-product of fibre processing). Change this if it should count differently.
- "Comes from" wording for wood flour, hemp dust, seagrass and cotton is a plain-language summary and should be checked by the project team.
