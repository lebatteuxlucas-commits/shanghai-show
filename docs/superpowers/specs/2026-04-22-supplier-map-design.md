# Supplier Map — Design

**Status:** Approved for planning
**Date:** 2026-04-22
**Target file:** `china_cycle_suppliers.html` (single-file app)

## Problem

The FutureMotion Supplier Intelligence app has a searchable table of 2,787 China Cycle 2025 exhibitors, grouped by hall via chip filters. A visitor arriving at the NECC Shanghai venue with a shortlisted supplier still has to translate "Hall E6" into a mental picture of where to walk. There is no spatial view that answers *"where in the venue is this supplier?"* in one glance.

## Goal

Add a new **Map** tab that answers supplier-first location questions faster than scrolling the table. Primary job: type a supplier name, see which hall they are in on a schematic of the venue. Secondary job: click a hall, see who is inside.

## Non-goals

- Not a replacement for the Suppliers tab (detail lookup + list browsing stay there).
- Not a geographic world map of supplier HQs.
- Not booth-level precision — source data has only hall codes (e.g., `E6`), not `E6-A21`. The map pin sits at the visual center of the hall.
- No new backend, no external map libraries, no build step. Pure SVG + vanilla JS in the existing single HTML file.

## Scope & placement

One new tab added to the existing nav between **Catalogs** and **Discover**:

```
Suppliers · Products · Shortlist · Catalogs · Map · Discover
```

All work lives in `china_cycle_suppliers.html`: one new `#view-map` container, one `switchTab('map')` branch, one CSS block, one JS block. No changes to existing tabs' behavior.

## Data

Uses the in-page `EXHIBITORS_DATA` array as-is (each row has `hall`, English + Chinese names, categories, scope). Adds one new in-file constant:

```js
// Shape only — concrete x/y/w/h values are hand-tuned during implementation
// (see "Map visual" section) and live entirely inside this constant.
const HALL_META = {
  E1: { en: "Bicycles",    cn: "整车品牌馆", wing: "E", x: 540, y: 90,  w: 170, h: 70 },
  E2: { en: "Accessories", cn: "零配件馆",   wing: "E", x: 540, y: 170, w: 170, h: 70 },
  // ... E3–E7, N1, W1–W5
};
```

The numbers above are illustrative; the implementer picks final coordinates so the rendered schematic matches the layout intent (W left / E right / N1 top spanning, central atrium in the middle, adjacent-numbered halls adjacent on screen). SVG viewBox is sized to contain all rects plus margin.

Supplier counts per hall are computed once from `EXHIBITORS_DATA` at init — not hardcoded, so the numbers stay correct if the data file is re-generated.

The 13 halls: `E1, E2, E3, E4, E5, E6, E7, N1, W1, W2, W3, W4, W5`.

## Page layout

Desktop-first, matching the app's existing visual language (`--teal`, `--nav-bg`, Barlow Condensed / DM Sans / DM Mono):

```
┌─────────────────────────────────────────────────────────────┐
│ [search supplier/hall… ▾]  [category filter]  [Clear]       │  toolbar
├───────────────────────────────────────────┬─────────────────┤
│                                           │                 │
│        NECC spatial SVG schematic         │   side panel    │
│   (13 hall rects, wings labeled N/E/W,    │                 │
│        central atrium in the middle)      │                 │
│                                           │                 │
└───────────────────────────────────────────┴─────────────────┘
```

- **Map area:** fluid width, min-height ~520px, SVG viewBox so halls scale together.
- **Side panel:** fixed width ~320px on the right, background `var(--white)`, left border `var(--border)`.
- **Toolbar:** sticky at the top of the view (below the nav), background `var(--bg)`.
- Below ~900px viewport width: side panel stacks below the map (no mobile polish beyond "doesn't break").

## Map visual

Pure inline SVG, hand-positioned `<rect>` per hall:

- W halls left column, E halls right column, N1 spanning the top, a neutral "Central Atrium" placeholder in the middle.
- Hall neighbors follow the shuttle-route hints from the source page (`W1→W3→W5`, `E1→E3→E5→E7`) so adjacent numbers read as adjacent on screen.
- Each rect has `data-hall` and contains two `<text>` elements: hall code (DM Mono, 14px) + short English category (DM Sans, 10px).
- Hover: subtle border thicken + cursor pointer.
- State classes on the `<g>` wrapper: `.map-idle`, `.map-hall-selected`, `.map-supplier-selected` — CSS drives dimming via `opacity` on sibling rects.

Hall positions are hand-tuned approximations, not derived from a real floor plan. Target: a glance tells you "north / east / west." Acceptable to iterate pixel positions post-implementation.

## Interactions — three modes

### Mode 1 — Idle (default)

- All halls colored by wing (E / W / N each a slightly different teal tint).
- Side panel shows a short "How to use" block plus headline stats (13 halls, 2,787 suppliers, N suppliers per wing).

### Mode 2 — Supplier-selected

Triggered by picking a row from the search autocomplete.

- All halls dim (opacity 0.35) except the supplier's hall.
- A pin (SVG circle with a star glyph) appears at the center of that hall.
- Side panel swaps to supplier view:
  - Supplier name (English + Chinese)
  - Hall chip: `E6 · E-bikes & accessories`
  - Business scope text (if present)
  - **"Open full supplier details →"** button — calls the existing `openPanel(idx)` which opens the detail slide-over used by the Suppliers tab. (The slide-over already exists and supports being opened from any view; this is pure reuse.)

### Mode 3 — Hall-selected

Triggered by clicking a hall on the map, or typing a bare hall code (`E6`) into the search.

- That hall highlights in amber (`#F59E0B` with a 3px outer glow).
- Other halls stay at normal color (no dimming — user is browsing, not pinpointing).
- Side panel:
  - Hall header: code, English + Chinese name, supplier count.
  - A small filter input ("Filter within hall…").
  - Scrollable list of supplier rows (English name + optional Chinese). Click a row → Mode 2 for that supplier.

Mode transitions: clicking elsewhere on the map background or pressing the "Clear" toolbar button returns to Mode 1. Selecting a supplier from Mode 3's list goes to Mode 2. Clearing the search from Mode 2 returns to the previous mode if one exists, else Mode 1.

## Search bar

- Input is a `<div class="map-search">` wrapping an `<input>` with live autocomplete dropdown below it (native HTML, no library).
- On every keystroke: build a scored match list against a prebuilt search index array `[{en, cn, hall, idx}, ...]` over all exhibitors — O(n) pass, ~2,800 entries, runs in <5ms per check on a laptop. No debounce needed; keep it simple.
- Scoring: exact prefix match (English or Chinese) > substring match > token match. Top 8 shown.
- Special case: if the trimmed query matches a hall code in `HALL_META` (case-insensitive, e.g., `e6`, `E6`, `n1`), pressing Enter enters Mode 3 for that hall directly.
- Keyboard: ↑/↓ navigate suggestions, Enter picks, Esc clears.

## Category filter

Reuses the existing category dropdown (so UX is consistent with the Suppliers tab). When a category is selected:

- Halls that contain zero suppliers in that category get an additional `.map-hall-empty` class (reduced opacity ~0.15).
- Search autocomplete restricts to suppliers matching the category.
- Idle side-panel stats update to reflect filtered counts.

Clearing the category returns all halls to full color.

## State

All state is in-memory only, no URL persistence (matches how other tabs behave). Global vars local to the map module:

```js
let mapMode = 'idle';              // 'idle' | 'supplier' | 'hall'
let mapSelectedHall = null;        // 'E6' etc.
let mapSelectedSupplierIdx = null; // index into EXHIBITORS_DATA
let mapQuery = '';
let mapCategory = '';              // mirrors the top-level category filter
let mapSearchIndex = null;         // lazily built on first tab entry
```

Tab switch: entering `map` for the first time triggers index build and SVG render; switching away does not tear anything down.

## Implementation shape

Inside `china_cycle_suppliers.html`:

1. **HTML** — `<div id="view-map" style="display:none">` containing the toolbar, an SVG, and a side panel. Position after `#view-discover` in the DOM.
2. **CSS** — new `.map-*` rules appended to the existing `<style>` block. Reuses theme variables. ~120 lines.
3. **JS** — new `// ── MAP ─────────` section with:
   - `HALL_META` constant (~40 lines).
   - `initMap()` — builds search index, renders SVG, attaches listeners. Called once.
   - `renderMap()` — applies current state to the DOM (mode class, highlight, pin).
   - `renderMapSidePanel()` — swaps panel content by mode.
   - `mapSearch(q)`, `mapPickSupplier(idx)`, `mapPickHall(code)`, `mapClear()` — event handlers.
   - Extend `switchTab` to call `initMap()` on first `'map'` entry.
   - Extend `updateTabCounts` to show `13` under the Map tab label (constant, all halls always visible).

No changes required to existing functions beyond the two small extensions above.

## Testing

This is a static single-file app with no test harness. Validation is manual:

1. **Idle state** — Map tab renders 13 halls + atrium, correct positions (W left / E right / N top), wing labels visible.
2. **Supplier search** — typing `"bafang"` surfaces Bafang Electric; pick it → hall E6 highlights, pin appears, side panel shows supplier info; clicking "Open full supplier details" opens the existing slide-over.
3. **Hall click** — click E6 rect → amber highlight, side panel lists 191 suppliers with in-hall filter working; clicking a row switches to supplier mode.
4. **Hall-code search** — typing `"E6"` + Enter → Mode 3 on E6.
5. **Category filter** — select "Electric Bicycle" → halls without e-bike suppliers dim further; counts update.
6. **Clear** — Clear button + Esc + empty search all return to idle.
7. **Cross-tab sanity** — switching to Map then back to Suppliers does not break the Suppliers table, filters, or shortlist.

## Risks & open questions

- **Hall geometry fidelity** — real NECC halls sit on two floors. Our schematic flattens this. Acceptable for an at-a-glance map; noted here so future polish is an option, not a bug.
- **Central Atrium label** — the source page mentions a newly opened N1 hall as a "major leap in the layout." We represent N1 but treat the atrium as a neutral placeholder (not a real hall). If NECC adds other halls in future editions, `HALL_META` is the single point of change.
- **Chinese name search tokenization** — we do substring matching only; no CJK tokenizer. Good enough for 2,787 entries; revisit if data grows.
