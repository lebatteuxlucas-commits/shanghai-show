# Supplier Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new Map tab to `china_cycle_suppliers.html` that renders an SVG floor-plan schematic of the 13 NECC Shanghai halls, with search-to-highlight and hall-click-to-list interactions for the 2,787 supplier rows already in the page.

**Architecture:** Single-file, self-contained. One new `#view-map` container hosting a toolbar + inline SVG schematic + side panel. One `HALL_META` constant encoding hall geometry. Pure vanilla JS event handlers reading/writing to three state variables. Reuses the existing `RAW[]` supplier array, the existing `openPanel(idx)` slide-over, and the existing theme CSS variables.

**Tech Stack:** Plain HTML, CSS, vanilla JavaScript. Inline SVG (no map library). Edits a single file — no build step, no tests, no package manager. Validation is manual in a browser.

**Non-standard conventions for this plan:**
- **No git, no tests:** This repo is not a git checkout and has no test harness. Each task ends with a **Checkpoint** (save file, open in browser, run the listed verification steps) instead of `git commit` or `pytest`.
- **Line-range anchors may drift** between tasks as code is inserted. Where a task says "insert after line X," locate the anchor text, not the exact line number.
- **Target file throughout:** `china_cycle_suppliers.html` (one file for every task).

---

## File structure

Only one file is touched: `china_cycle_suppliers.html`.

Five logical regions will receive additions:

1. **Nav** (around line 970, inside `<div class="nav-tabs">`) — new `<button>` for the Map tab.
2. **CSS `<style>` block** (appending near line 944, before the `</style>`) — all `.map-*` rules.
3. **View container** (bottom of `<body>`, after `#view-discover`) — the `<div id="view-map">` with toolbar, SVG, side panel.
4. **JS constants region** (after the `RAW_IDX` declaration, around line 1144) — `HALL_META` and map state variables.
5. **JS functions region** (after the `renderDiscover()` area, before closing `</script>`) — the map module: `initMap`, `renderMap`, `renderMapSidePanel`, `mapSearch`, `mapPickSupplier`, `mapPickHall`, `mapClear`, and DOM event handlers.

All five regions are independent text additions — no refactoring of existing code, only two tiny extensions to `switchTab` and `updateTabCounts`.

---

## Task 1: Scaffold the Map tab (nav button, empty view, switchTab hook)

**Files:**
- Modify: `china_cycle_suppliers.html` — nav block (~line 957–973), `switchTab` array (~line 1331), end of `<body>` (after `</div>` closing `#view-discover`)

- [ ] **Step 1: Add the Map nav button**

Locate this block (around line 967–972 of the original file):

```html
    <button class="nav-tab" onclick="switchTab('catalogs')" id="tab-catalogs">
      Catalogs <span class="tab-count" id="tc-catalogs">0</span>
    </button>
    <button class="nav-tab" onclick="switchTab('discover')" id="tab-discover">
      Discover
    </button>
```

Insert a new button between Catalogs and Discover:

```html
    <button class="nav-tab" onclick="switchTab('catalogs')" id="tab-catalogs">
      Catalogs <span class="tab-count" id="tc-catalogs">0</span>
    </button>
    <button class="nav-tab" onclick="switchTab('map')" id="tab-map">
      Map <span class="tab-count" id="tc-map">13</span>
    </button>
    <button class="nav-tab" onclick="switchTab('discover')" id="tab-discover">
      Discover
    </button>
```

- [ ] **Step 2: Extend the switchTab tabs array**

Locate `switchTab` around line 1329. The array currently reads:

```js
  ['suppliers','products','shortlist','catalogs','discover'].forEach(t => {
```

Change to:

```js
  ['suppliers','products','shortlist','catalogs','map','discover'].forEach(t => {
```

- [ ] **Step 3: Add the empty view container**

Find the line near the end of `<body>` that closes the Discover view. Right after `</div>` closing `#view-discover` and *before* `<script>`, insert:

```html
<!-- ═══════════════════════════════════════════════════════════════════════
     VIEW: MAP
     Spatial schematic of the 13 NECC Shanghai halls used by China Cycle.
     ═══════════════════════════════════════════════════════════════════════ -->
<div id="view-map" style="display:none">
  <div class="map-shell">
    <div class="map-toolbar">
      <div class="map-search-wrap">
        <span class="map-search-icon">🔍</span>
        <input type="search" id="mapSearchInput" placeholder="Search supplier or hall code (e.g. E6)…" autocomplete="off">
        <div class="map-autocomplete" id="mapAutocomplete" hidden></div>
      </div>
      <select id="mapCatFilter" class="map-cat">
        <option value="">All categories</option>
        <option>Complete Bikes</option>
        <option>Frames, Forks &amp; Parts</option>
        <option>Tires, Rims &amp; Parts</option>
        <option>Transmissions &amp; Parts</option>
        <option>Steering &amp; Components</option>
        <option>Accessories</option>
        <option>Machinery &amp; Tools</option>
        <option>Cycling/Outdoor Products</option>
        <option>Electric Bicycle</option>
        <option>E-Bike Parts &amp; Accessories</option>
        <option>Other</option>
      </select>
      <button type="button" class="map-clear" id="mapClearBtn">Clear</button>
    </div>
    <div class="map-body">
      <div class="map-canvas" id="mapCanvas">
        <!-- SVG injected by renderMap() -->
      </div>
      <aside class="map-panel" id="mapPanel">
        <!-- Populated by renderMapSidePanel() -->
      </aside>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Checkpoint**

Save the file. Open `china_cycle_suppliers.html` in a browser.

Expected:
- The top nav now shows: Suppliers · Products · Shortlist · Catalogs · **Map (13)** · Discover.
- Clicking **Map** hides the Suppliers table and shows an empty gray area (the toolbar renders with a search input, category dropdown, and Clear button; the map canvas and side panel are empty until Task 3/4).
- Clicking any other tab still works exactly as before (regression: Products, Shortlist, Catalogs, Discover, and Suppliers all render normally).

---

## Task 2: Base CSS for the map shell, toolbar, canvas, panel

**Files:**
- Modify: `china_cycle_suppliers.html` — inside the `<style>` block, immediately before `</style>` (around line 944)

- [ ] **Step 1: Append the map CSS block**

Find `</style>` (near line 944, just before `</head>`). Insert this block immediately before it:

```css
/* ── MAP TAB ─────────────────────────────────────────────────────────────── */
.map-shell {
  display: flex; flex-direction: column;
  background: var(--bg);
  min-height: calc(100vh - 56px);
}
.map-toolbar {
  display: flex; gap: 12px; align-items: center;
  padding: 14px 24px;
  background: var(--white);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 56px; z-index: 50;
}
.map-search-wrap { position: relative; flex: 1; max-width: 520px; }
.map-search-wrap .map-search-icon {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  font-size: 13px; opacity: 0.55;
}
#mapSearchInput {
  width: 100%;
  padding: 9px 12px 9px 34px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  background: var(--bg);
}
#mapSearchInput:focus { outline: none; border-color: var(--teal); background: var(--white); }
.map-autocomplete {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: var(--shadow);
  max-height: 340px; overflow-y: auto;
  z-index: 60;
}
.map-ac-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}
.map-ac-row:last-child { border-bottom: none; }
.map-ac-row:hover, .map-ac-row.active { background: var(--teal-light); }
.map-ac-row .ac-en { font-weight: 600; color: var(--black); }
.map-ac-row .ac-cn { color: var(--mid); font-size: 11px; margin-top: 2px; }
.map-ac-row .ac-hall {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--teal);
  background: var(--teal-light);
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 700;
  margin-left: 12px;
  white-space: nowrap;
}
.map-ac-empty { padding: 12px; font-size: 12px; color: var(--mid); text-align: center; }
.map-cat {
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  background: var(--white);
  min-width: 180px;
}
.map-clear {
  padding: 9px 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  color: var(--dark);
}
.map-clear:hover { background: var(--border); }

.map-body {
  display: flex;
  flex: 1;
  min-height: 560px;
}
.map-canvas {
  flex: 1;
  padding: 20px;
  background: var(--bg);
  display: flex; align-items: center; justify-content: center;
}
.map-canvas svg { width: 100%; height: auto; max-width: 900px; }
.map-panel {
  width: 320px;
  background: var(--white);
  border-left: 1px solid var(--border);
  padding: 18px;
  overflow-y: auto;
  max-height: calc(100vh - 56px - 60px);
}

/* Responsive: stack below a medium width */
@media (max-width: 900px) {
  .map-body { flex-direction: column; }
  .map-panel { width: 100%; border-left: none; border-top: 1px solid var(--border); }
}
```

- [ ] **Step 2: Checkpoint**

Save, reload in browser, click Map tab.

Expected:
- Toolbar spans full width with a teal-focusable search input, a category dropdown, and a Clear button.
- Below the toolbar, an empty gray canvas area and a white right-hand panel area are visible, side-by-side.
- Narrowing the browser window below ~900px stacks the panel below the canvas.

---

## Task 3: Define HALL_META and initial state variables

**Files:**
- Modify: `china_cycle_suppliers.html` — JS constants region, immediately after `const RAW_IDX = new Map(...)` around line 1144

- [ ] **Step 1: Insert the HALL_META constant and module state**

Find `const RAW_IDX = new Map(RAW.map((e, i) => [e, i]));` (around line 1144). Insert immediately after it:

```js
// ── MAP DATA ──────────────────────────────────────────────────────────────
// Hand-tuned positions approximating the NECC Shanghai hall layout for China Cycle.
// viewBox is 800 × 540. W halls on the left (odd numbers outer column, even inner).
// E halls on the right (odd outer column). N1 spans the top. Central atrium in the middle.
const HALL_META = {
  N1: { en: "International Brands",    cn: "两轮品牌馆",           wing: "N", x: 180, y:  25, w: 440, h: 55 },
  W1: { en: "International brands",    cn: "国际品牌馆",           wing: "W", x:  30, y: 110, w: 110, h: 60 },
  W2: { en: "Bicycles & accessories",  cn: "整车及零配件馆",       wing: "W", x: 150, y: 110, w: 110, h: 60 },
  W3: { en: "Children's bikes",        cn: "童车馆",               wing: "W", x:  30, y: 180, w: 110, h: 60 },
  W4: { en: "Cycling & outdoor",       cn: "户外骑行装备馆",       wing: "W", x: 150, y: 180, w: 110, h: 60 },
  W5: { en: "Two-Wheel Brands",        cn: "品牌创新馆",           wing: "W", x:  30, y: 250, w: 230, h: 60 },
  E1: { en: "Bicycles",                cn: "整车品牌馆",           wing: "E", x: 540, y: 110, w: 110, h: 55 },
  E2: { en: "Accessories",             cn: "零配件馆",             wing: "E", x: 660, y: 110, w: 110, h: 55 },
  E3: { en: "Accessories",             cn: "零配件馆",             wing: "E", x: 540, y: 175, w: 110, h: 55 },
  E4: { en: "Tires & accessories",     cn: "轮胎及零配件馆",       wing: "E", x: 660, y: 175, w: 110, h: 55 },
  E5: { en: "E-bikes accessories",     cn: "电动车零配件馆",       wing: "E", x: 540, y: 240, w: 110, h: 55 },
  E6: { en: "E-bikes & accessories",   cn: "电动车及零配件馆",     wing: "E", x: 660, y: 240, w: 110, h: 55 },
  E7: { en: "E-bike brands",           cn: "电动车品牌馆",         wing: "E", x: 540, y: 305, w: 230, h: 55 },
};
const HALL_CODES = Object.keys(HALL_META); // stable iteration order

// Supplier counts per hall, computed once from RAW.
const HALL_COUNTS = (() => {
  const c = Object.fromEntries(HALL_CODES.map(h => [h, 0]));
  for (const e of RAW) if (c.hasOwnProperty(e.hall)) c[e.hall]++;
  return c;
})();

// Map module state (all in-memory, no URL persistence).
let mapMode = 'idle';              // 'idle' | 'supplier' | 'hall'
let mapSelectedHall = null;        // e.g. 'E6'
let mapSelectedSupplierIdx = null; // index into RAW
let mapQuery = '';
let mapCategory = '';
let mapHallFilter = '';            // in-hall filter text (Mode 3)
let mapAcActive = -1;              // active autocomplete row index
let mapSearchIndex = null;         // lazily built on first initMap()
let mapInitialized = false;
```

- [ ] **Step 2: Checkpoint**

Save, reload. Open the browser DevTools console and click the Map tab.

Expected: No errors. Type `HALL_META` in the console → see the 13-hall object. Type `HALL_COUNTS` → see counts like `{N1: 668, W1: 161, ...}` that roughly match the `halls.csv` table (minor discrepancies are OK if the RAW data has slight differences from the published counts).

---

## Task 4: Build and render the SVG schematic (idle mode)

**Files:**
- Modify: `china_cycle_suppliers.html` — JS functions region, just before the closing `</script>` at the bottom

- [ ] **Step 1: Add the map renderer functions**

Find the closing `</script>` at the bottom of the file. Insert the following block immediately before it:

```js
// ═══════════════════════════════════════════════════════════════════════════
// MAP MODULE
// ═══════════════════════════════════════════════════════════════════════════

function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  // Build search index once.
  mapSearchIndex = RAW.map((e, i) => ({
    idx: i,
    en: e.en,
    enLc: (e._en_lc || e.en.toLowerCase()),
    cn: e.cn || '',
    hall: e.hall,
    cats: e.cats || [],
  }));

  renderMapSvg();
  renderMap();
  wireMapEvents();
}

function renderMapSvg() {
  const halls = HALL_CODES.map(code => {
    const m = HALL_META[code];
    const count = HALL_COUNTS[code];
    return `
      <g class="map-hall" data-hall="${code}" data-wing="${m.wing}">
        <rect class="map-hall-rect" x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="6"></rect>
        <text class="map-hall-code" x="${m.x + m.w / 2}" y="${m.y + 22}" text-anchor="middle">${code}</text>
        <text class="map-hall-name" x="${m.x + m.w / 2}" y="${m.y + 38}" text-anchor="middle">${escSvg(m.en)}</text>
        <text class="map-hall-count" x="${m.x + m.w / 2}" y="${m.y + 52}" text-anchor="middle">${count} suppliers</text>
      </g>
    `;
  }).join('');

  const svg = `
    <svg viewBox="0 0 800 540" xmlns="http://www.w3.org/2000/svg" aria-label="NECC Shanghai hall map">
      <g id="mapHalls">${halls}</g>
      <g id="mapAtrium">
        <rect x="300" y="110" width="200" height="260" rx="6"
              fill="#EEF0F4" stroke="#BFBBB2" stroke-dasharray="4 3"></rect>
        <text x="400" y="235" text-anchor="middle" class="map-atrium-label">Central</text>
        <text x="400" y="252" text-anchor="middle" class="map-atrium-label">Atrium</text>
      </g>
      <g id="mapCompass">
        <text x="400" y="18"  text-anchor="middle" class="map-compass">NORTH ↑</text>
        <text x="22"  y="380" text-anchor="start"  class="map-compass">WEST ↤</text>
        <text x="778" y="380" text-anchor="end"    class="map-compass">↦ EAST</text>
      </g>
      <g id="mapPin" style="display:none">
        <circle cx="0" cy="0" r="13" fill="#F59E0B" stroke="#FDFCF9" stroke-width="3"></circle>
        <text x="0" y="5" text-anchor="middle" fill="#FDFCF9" font-size="14" font-weight="700">★</text>
      </g>
    </svg>
  `;
  document.getElementById('mapCanvas').innerHTML = svg;
}

function renderMap() {
  // Apply mode class for CSS-driven styling.
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) return;
  canvas.classList.remove('map-mode-idle', 'map-mode-supplier', 'map-mode-hall');
  canvas.classList.add('map-mode-' + mapMode);

  // Selected/dim state per hall.
  document.querySelectorAll('.map-hall').forEach(g => {
    const code = g.getAttribute('data-hall');
    g.classList.toggle('map-hall-selected', code === mapSelectedHall);
    g.classList.toggle('map-hall-dim', mapMode === 'supplier' && code !== mapSelectedHall);

    // Category-empty state (set by Task 9; safe to compute always).
    const empty = mapCategory && !hallHasCategory(code, mapCategory);
    g.classList.toggle('map-hall-empty', empty);
  });

  // Pin placement for supplier mode.
  const pin = document.getElementById('mapPin');
  if (pin) {
    if (mapMode === 'supplier' && mapSelectedHall && HALL_META[mapSelectedHall]) {
      const m = HALL_META[mapSelectedHall];
      pin.setAttribute('transform', `translate(${m.x + m.w / 2}, ${m.y + m.h / 2 + 4})`);
      pin.style.display = '';
    } else {
      pin.style.display = 'none';
    }
  }

  renderMapSidePanel();
}

function renderMapSidePanel() {
  const panel = document.getElementById('mapPanel');
  if (!panel) return;

  if (mapMode === 'supplier' && mapSelectedSupplierIdx != null) {
    const e = RAW[mapSelectedSupplierIdx];
    const hall = HALL_META[e.hall];
    panel.innerHTML = `
      <div class="map-panel-section">
        <div class="map-panel-label">Supplier</div>
        <div class="map-panel-title">${esc(e.en)}</div>
        ${e.cn ? `<div class="map-panel-cn">${esc(e.cn)}</div>` : ''}
      </div>
      <div class="map-panel-section">
        <div class="map-hall-chip"><strong>${e.hall}</strong> · ${esc(hall ? hall.en : e.hallEn || '')}</div>
      </div>
      ${e.scope ? `<div class="map-panel-section"><div class="map-panel-label">Business scope</div><div class="map-panel-text">${esc(e.scope)}</div></div>` : ''}
      <button type="button" class="map-panel-cta" onclick="openPanel(${mapSelectedSupplierIdx})">
        Open full supplier details →
      </button>
    `;
    return;
  }

  if (mapMode === 'hall' && mapSelectedHall) {
    const meta = HALL_META[mapSelectedHall];
    const allRows = RAW
      .map((e, i) => ({ e, i }))
      .filter(x => x.e.hall === mapSelectedHall)
      .filter(x => !mapCategory || (x.e.cats || []).includes(mapCategory));
    const q = mapHallFilter.toLowerCase();
    const rows = q
      ? allRows.filter(x => (x.e._en_lc || '').includes(q) || (x.e.cn || '').includes(mapHallFilter))
      : allRows;
    const listHtml = rows.length
      ? rows.map(x => `
          <div class="map-hall-row" onclick="mapPickSupplier(${x.i})">
            <div class="map-hall-row-en">${esc(x.e.en)}</div>
            ${x.e.cn ? `<div class="map-hall-row-cn">${esc(x.e.cn)}</div>` : ''}
          </div>
        `).join('')
      : `<div class="map-hall-empty-msg">No suppliers match the current filter.</div>`;
    panel.innerHTML = `
      <div class="map-panel-section">
        <div class="map-panel-label">Hall</div>
        <div class="map-panel-title">${mapSelectedHall} · ${esc(meta.en)}</div>
        <div class="map-panel-cn">${esc(meta.cn)}</div>
        <div class="map-panel-sub">${allRows.length} suppliers${mapCategory ? ` in "${esc(mapCategory)}"` : ''}</div>
      </div>
      <input type="search" class="map-hall-filter" placeholder="Filter within hall…"
             value="${esc(mapHallFilter)}" oninput="mapSetHallFilter(this.value)">
      <div class="map-hall-list">${listHtml}</div>
    `;
    return;
  }

  // Idle
  const totalE = HALL_CODES.filter(h => h.startsWith('E')).reduce((s, h) => s + HALL_COUNTS[h], 0);
  const totalW = HALL_CODES.filter(h => h.startsWith('W')).reduce((s, h) => s + HALL_COUNTS[h], 0);
  const totalN = HALL_CODES.filter(h => h.startsWith('N')).reduce((s, h) => s + HALL_COUNTS[h], 0);
  panel.innerHTML = `
    <div class="map-panel-section">
      <div class="map-panel-title">Shanghai venue map</div>
      <div class="map-panel-sub">13 halls · ${RAW.length.toLocaleString()} suppliers</div>
    </div>
    <div class="map-panel-section">
      <div class="map-panel-label">How to use</div>
      <ul class="map-panel-list">
        <li>Type a supplier name to highlight their hall.</li>
        <li>Type a hall code (e.g. <code>E6</code>) and press Enter to browse it.</li>
        <li>Click any hall on the map to see who exhibits there.</li>
      </ul>
    </div>
    <div class="map-panel-section">
      <div class="map-panel-label">By wing</div>
      <div class="map-panel-stats">
        <div><span class="sw-dot sw-n"></span>North — ${totalN.toLocaleString()}</div>
        <div><span class="sw-dot sw-e"></span>East — ${totalE.toLocaleString()}</div>
        <div><span class="sw-dot sw-w"></span>West — ${totalW.toLocaleString()}</div>
      </div>
    </div>
  `;
}

function hallHasCategory(code, cat) {
  if (!mapSearchIndex) return true;
  return mapSearchIndex.some(x => x.hall === code && x.cats.includes(cat));
}

// Pared-down HTML escape — reuses existing `esc` for strings, adds SVG-safe for attributes/text.
function escSvg(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Placeholder stubs — implemented in later tasks.
function wireMapEvents() { /* Task 5+ */ }
function mapPickSupplier(idx) { /* Task 7 */ }
function mapPickHall(code) { /* Task 5 */ }
function mapClear() { /* Task 8 */ }
function mapSetHallFilter(v) { /* Task 10 */ }
```

- [ ] **Step 2: Extend switchTab to call initMap**

Locate the existing `switchTab` body (~line 1341–1344):

```js
  if (tab === 'products')  renderProducts();
  if (tab === 'shortlist') renderShortlist();
  if (tab === 'catalogs')  renderCatalogs();
  if (tab === 'discover')  renderDiscover();
```

Add a line for `map`:

```js
  if (tab === 'products')  renderProducts();
  if (tab === 'shortlist') renderShortlist();
  if (tab === 'catalogs')  renderCatalogs();
  if (tab === 'map')       initMap();
  if (tab === 'discover')  renderDiscover();
```

- [ ] **Step 3: Add SVG + side panel CSS**

Append to the `/* ── MAP TAB */` CSS block from Task 2 (inside `<style>`):

```css
/* SVG hall rects */
.map-hall { cursor: pointer; transition: opacity 0.18s ease; }
.map-hall-rect {
  fill: #BFE5D4;
  stroke: #1A9A6F;
  stroke-width: 2;
  transition: fill 0.18s ease, stroke 0.18s ease;
}
.map-hall[data-wing="E"] .map-hall-rect { fill: #D3EFE1; }
.map-hall[data-wing="W"] .map-hall-rect { fill: #C7EBDA; }
.map-hall[data-wing="N"] .map-hall-rect { fill: #B0DDC7; }
.map-hall:hover .map-hall-rect { fill: #9ED9BA; stroke-width: 3; }
.map-hall-selected .map-hall-rect {
  fill: #FEE4A6 !important;
  stroke: #F59E0B;
  stroke-width: 3;
}
.map-hall-dim { opacity: 0.28; }
.map-hall-empty { opacity: 0.15; }

.map-hall-code {
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 700;
  fill: #0D0B09;
  pointer-events: none;
  user-select: none;
}
.map-hall-name {
  font-family: 'DM Sans', sans-serif;
  font-size: 10px;
  fill: #1C1A16;
  pointer-events: none;
  user-select: none;
}
.map-hall-count {
  font-family: var(--mono);
  font-size: 9px;
  fill: #6E6A62;
  pointer-events: none;
  user-select: none;
}
.map-atrium-label {
  font-family: var(--mono);
  font-size: 10px;
  fill: #6E6A62;
  letter-spacing: 1px;
}
.map-compass {
  font-family: var(--mono);
  font-size: 9px;
  fill: #9A9689;
  letter-spacing: 1px;
}

/* Side panel */
.map-panel-section { margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.map-panel-section:last-of-type { border-bottom: none; }
.map-panel-label {
  font-family: var(--mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--mid);
  margin-bottom: 6px;
}
.map-panel-title {
  font-family: 'DM Sans', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--black);
  line-height: 1.3;
}
.map-panel-cn { color: var(--mid); font-size: 12px; margin-top: 2px; }
.map-panel-sub { color: var(--mid); font-size: 11px; margin-top: 4px; }
.map-panel-text { color: var(--dark); font-size: 12px; line-height: 1.5; }
.map-panel-list { padding-left: 18px; color: var(--dark); font-size: 12px; line-height: 1.6; }
.map-panel-list code {
  font-family: var(--mono);
  background: var(--teal-light);
  color: var(--teal-dark);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
}
.map-panel-stats { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--dark); }
.sw-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
.sw-n { background: #B0DDC7; }
.sw-e { background: #D3EFE1; }
.sw-w { background: #C7EBDA; }

.map-hall-chip {
  display: inline-block;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--teal-dark);
  background: var(--teal-light);
  padding: 4px 10px;
  border-radius: 3px;
}
.map-hall-chip strong { color: var(--teal); }

.map-panel-cta {
  width: 100%;
  padding: 10px;
  background: var(--teal);
  color: var(--white);
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  margin-top: 6px;
}
.map-panel-cta:hover { background: var(--teal-dark); }

.map-hall-filter {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  margin-bottom: 10px;
  background: var(--bg);
}
.map-hall-list { display: flex; flex-direction: column; gap: 4px; }
.map-hall-row {
  padding: 7px 10px;
  background: var(--bg);
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid transparent;
}
.map-hall-row:hover { border-color: var(--teal); background: var(--teal-light); }
.map-hall-row-en { font-size: 12px; font-weight: 500; color: var(--black); }
.map-hall-row-cn { font-size: 10px; color: var(--mid); margin-top: 1px; }
.map-hall-empty-msg { color: var(--mid); font-size: 12px; padding: 8px; font-style: italic; }
```

- [ ] **Step 4: Checkpoint**

Save, reload, click the Map tab.

Expected:
- 13 labeled hall rectangles appear in a schematic layout: N1 across the top, W halls on the left (W1/W2 row, W3/W4 row, W5 wide), E halls on the right (E1/E2 row, E3/E4 row, E5/E6 row, E7 wide), with a dashed "Central Atrium" in the middle.
- Each rectangle shows hall code, short English name, and supplier count.
- North/West/East compass labels render along the edges.
- Side panel shows a title, "How to use" list, and per-wing counts.
- Hovering a hall darkens it slightly — no click behavior yet.
- No console errors.

---

## Task 5: Hall click → hall-selected mode (Mode 3)

**Files:**
- Modify: `china_cycle_suppliers.html` — replace the `mapPickHall`, `mapClear`, `wireMapEvents`, and `mapSetHallFilter` stubs added in Task 4

- [ ] **Step 1: Implement `mapPickHall`, `mapClear`, `mapSetHallFilter`**

Find the stub lines inside the MAP MODULE block:

```js
function wireMapEvents() { /* Task 5+ */ }
function mapPickSupplier(idx) { /* Task 7 */ }
function mapPickHall(code) { /* Task 5 */ }
function mapClear() { /* Task 8 */ }
function mapSetHallFilter(v) { /* Task 10 */ }
```

Replace the three we're implementing now (keep `mapPickSupplier` stub and overwrite `mapClear` in Task 8 — for now a minimal `mapClear` is fine):

```js
function wireMapEvents() {
  // Click on hall rect → enter hall mode.
  document.querySelectorAll('.map-hall').forEach(g => {
    g.addEventListener('click', ev => {
      ev.stopPropagation();
      const code = g.getAttribute('data-hall');
      mapPickHall(code);
    });
  });

  // Click on empty map background → clear.
  const canvas = document.getElementById('mapCanvas');
  if (canvas) {
    canvas.addEventListener('click', ev => {
      if (ev.target.closest('.map-hall')) return;
      if (ev.target.closest('#mapPin')) return;
      mapClear();
    });
  }
}

function mapPickSupplier(idx) { /* implemented in Task 7 */ }

function mapPickHall(code) {
  if (!HALL_META[code]) return;
  mapMode = 'hall';
  mapSelectedHall = code;
  mapSelectedSupplierIdx = null;
  mapHallFilter = '';
  renderMap();
}

function mapClear() {
  mapMode = 'idle';
  mapSelectedHall = null;
  mapSelectedSupplierIdx = null;
  mapHallFilter = '';
  renderMap();
}

function mapSetHallFilter(v) {
  mapHallFilter = v || '';
  renderMapSidePanel();
}
```

- [ ] **Step 2: Checkpoint**

Save, reload, click the Map tab.

Expected:
- Clicking hall **E6** turns it amber with a thicker orange border; side panel now reads "Hall E6 · E-bikes & accessories", "电动车及零配件馆", "191 suppliers" (or similar), an in-hall filter input, and a scrollable list of supplier rows. Each row shows the company name (EN + CN).
- Clicking a different hall (e.g. **W1**) switches the amber highlight and updates the panel.
- Typing in the in-hall filter input narrows the list live (try typing a few letters of a supplier in that hall).
- Clicking on empty background (not on any hall) returns to idle — side panel reverts to "How to use."
- Clicking a supplier row does nothing yet (Task 7).

---

## Task 6: Search index, autocomplete, and keyboard navigation

**Files:**
- Modify: `china_cycle_suppliers.html` — extend `wireMapEvents` and add `mapSearch`, `renderMapAutocomplete`, keyboard handlers

- [ ] **Step 1: Replace wireMapEvents with the search-wiring version**

Find the current `wireMapEvents` body from Task 5 and replace the entire function with:

```js
function wireMapEvents() {
  // Hall click.
  document.querySelectorAll('.map-hall').forEach(g => {
    g.addEventListener('click', ev => {
      ev.stopPropagation();
      mapPickHall(g.getAttribute('data-hall'));
    });
  });

  // Background click → clear.
  const canvas = document.getElementById('mapCanvas');
  if (canvas) {
    canvas.addEventListener('click', ev => {
      if (ev.target.closest('.map-hall')) return;
      if (ev.target.closest('#mapPin')) return;
      mapClear();
    });
  }

  // Search input.
  const input = document.getElementById('mapSearchInput');
  if (input) {
    input.addEventListener('input', () => {
      mapQuery = input.value;
      mapAcActive = -1;
      renderMapAutocomplete();
    });
    input.addEventListener('keydown', ev => {
      const rows = document.querySelectorAll('.map-ac-row');
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        if (rows.length) {
          mapAcActive = (mapAcActive + 1) % rows.length;
          highlightMapAcRow();
        }
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (rows.length) {
          mapAcActive = (mapAcActive - 1 + rows.length) % rows.length;
          highlightMapAcRow();
        }
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const q = mapQuery.trim().toUpperCase();
        if (HALL_META[q]) {           // bare hall code → hall mode
          hideMapAutocomplete();
          input.value = '';
          mapQuery = '';
          mapPickHall(q);
          return;
        }
        if (mapAcActive >= 0 && rows[mapAcActive]) {
          rows[mapAcActive].click();
        } else if (rows[0]) {
          rows[0].click();
        }
      } else if (ev.key === 'Escape') {
        input.value = '';
        mapQuery = '';
        hideMapAutocomplete();
        if (mapMode === 'supplier') mapClear();
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(hideMapAutocomplete, 120);    // delay so click on row registers
    });
  }
}

function mapSearch(q) {
  const query = (q || '').trim();
  if (!query) return [];
  const qLc = query.toLowerCase();
  const results = [];
  for (const item of mapSearchIndex) {
    if (mapCategory && !item.cats.includes(mapCategory)) continue;
    let score = 0;
    if (item.enLc === qLc)            score = 100;
    else if (item.enLc.startsWith(qLc)) score = 80;
    else if (item.cn.startsWith(query)) score = 75;
    else if (item.enLc.includes(qLc))   score = 50;
    else if (item.cn.includes(query))   score = 45;
    else if (item.hall.toLowerCase().includes(qLc)) score = 20;
    if (score > 0) results.push({ item, score });
  }
  results.sort((a, b) => b.score - a.score || a.item.enLc.localeCompare(b.item.enLc));
  return results.slice(0, 8).map(r => r.item);
}

function renderMapAutocomplete() {
  const ac = document.getElementById('mapAutocomplete');
  if (!ac) return;
  const q = mapQuery.trim();
  if (!q) {
    hideMapAutocomplete();
    return;
  }
  // If the query is a bare hall code, offer a "Go to hall" row.
  const upper = q.toUpperCase();
  const hallShortcut = HALL_META[upper]
    ? `<div class="map-ac-row" data-kind="hall" data-code="${upper}" onmousedown="mapPickHall('${upper}');mapClearSearch();">
         <div>
           <div class="ac-en">Go to hall ${upper}</div>
           <div class="ac-cn">${esc(HALL_META[upper].en)}</div>
         </div>
         <span class="ac-hall">${HALL_COUNTS[upper]} suppliers</span>
       </div>`
    : '';

  const results = mapSearch(q);
  const rows = results.map(r => `
    <div class="map-ac-row" data-kind="supplier" data-idx="${r.idx}" onmousedown="mapPickSupplier(${r.idx});mapClearSearch();">
      <div>
        <div class="ac-en">${esc(r.en)}</div>
        ${r.cn ? `<div class="ac-cn">${esc(r.cn)}</div>` : ''}
      </div>
      <span class="ac-hall">${r.hall}</span>
    </div>
  `).join('');

  const empty = (!hallShortcut && !rows) ? `<div class="map-ac-empty">No suppliers match "${esc(q)}"${mapCategory ? ` in ${esc(mapCategory)}` : ''}.</div>` : '';

  ac.innerHTML = hallShortcut + rows + empty;
  ac.hidden = false;
}

function highlightMapAcRow() {
  const rows = document.querySelectorAll('.map-ac-row');
  rows.forEach((r, i) => r.classList.toggle('active', i === mapAcActive));
  if (mapAcActive >= 0 && rows[mapAcActive]) {
    rows[mapAcActive].scrollIntoView({ block: 'nearest' });
  }
}

function hideMapAutocomplete() {
  const ac = document.getElementById('mapAutocomplete');
  if (ac) { ac.hidden = true; ac.innerHTML = ''; }
  mapAcActive = -1;
}

function mapClearSearch() {
  const input = document.getElementById('mapSearchInput');
  if (input) input.value = '';
  mapQuery = '';
  hideMapAutocomplete();
}
```

- [ ] **Step 2: Checkpoint**

Save, reload, click the Map tab.

Expected:
- Focus the search input, type `bafang`. A dropdown appears below the input with up to 8 matching suppliers (English name, optional Chinese name, hall code on the right).
- Typing `e6` shows "Go to hall E6" as the first row.
- ↓ / ↑ arrow keys move highlight through rows; rows stay visually highlighted.
- Pressing Enter on the "Go to hall E6" row (or with empty search after typing just `e6`) enters hall mode for E6.
- Pressing Esc clears the input and hides the dropdown.
- Clicking a supplier row does nothing yet (Task 7).

---

## Task 7: Pick supplier from autocomplete → supplier-selected mode (Mode 2)

**Files:**
- Modify: `china_cycle_suppliers.html` — replace the `mapPickSupplier` stub

- [ ] **Step 1: Implement `mapPickSupplier`**

Locate the stub:

```js
function mapPickSupplier(idx) { /* implemented in Task 7 */ }
```

Replace with:

```js
function mapPickSupplier(idx) {
  if (idx == null || !RAW[idx]) return;
  const e = RAW[idx];
  if (!HALL_META[e.hall]) return; // supplier's hall is not in our known set; bail
  mapMode = 'supplier';
  mapSelectedSupplierIdx = idx;
  mapSelectedHall = e.hall;
  renderMap();
  // Reflect in the search input for clarity.
  const input = document.getElementById('mapSearchInput');
  if (input) input.value = e.en;
  hideMapAutocomplete();
}
```

- [ ] **Step 2: Checkpoint**

Save, reload, click the Map tab. Type `bafang` in the search, click the top row.

Expected:
- All halls except the supplier's hall dim to ~28% opacity.
- The supplier's hall stays amber-highlighted; the star pin appears at the center.
- Side panel now shows:
  - "SUPPLIER" label, then the English name, then the Chinese name.
  - A teal chip with the hall code + English name.
  - Business scope paragraph (if the supplier has one).
  - A teal **"Open full supplier details →"** button.
- Clicking "Open full supplier details →" opens the existing slide-over used by the Suppliers tab for this supplier. Closing that slide-over returns focus to the Map without resetting state.
- Clicking on empty map background clears: dim removes, pin hides, panel returns to "How to use."
- From a hall-selected state, clicking a supplier row in the panel's list also enters supplier mode correctly (verify by clicking a hall, then clicking one of the rows).

---

## Task 8: Final `mapClear` polish, Clear button, input wiring

**Files:**
- Modify: `china_cycle_suppliers.html` — wire the Clear button and ensure `mapClear` resets the category filter's input-visible state without clearing the filter itself

- [ ] **Step 1: Replace the `mapClear` stub with the full version**

Locate the current `mapClear` from Task 5 and replace it with:

```js
function mapClear() {
  mapMode = 'idle';
  mapSelectedHall = null;
  mapSelectedSupplierIdx = null;
  mapHallFilter = '';
  mapQuery = '';
  const input = document.getElementById('mapSearchInput');
  if (input) input.value = '';
  hideMapAutocomplete();
  renderMap();
}
```

- [ ] **Step 2: Wire the Clear button inside wireMapEvents**

Inside `wireMapEvents`, at the end of the function (after the search input listener), append:

```js
  // Toolbar Clear button.
  const clearBtn = document.getElementById('mapClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      mapCategory = '';
      const sel = document.getElementById('mapCatFilter');
      if (sel) sel.value = '';
      mapClear();
    });
  }
```

- [ ] **Step 3: Checkpoint**

Save, reload, click the Map tab.

Expected:
- Type `bafang`, pick the supplier (supplier mode). Click the **Clear** button → search input empties, dim lifts, pin hides, panel returns to idle.
- Click hall **W5** (hall mode). Click **Clear** → same reset to idle.
- The Clear button is a no-op from idle mode (harmless).
- Esc key from any mode also resets (already wired in Task 6).

---

## Task 9: Category filter integration

**Files:**
- Modify: `china_cycle_suppliers.html` — wire the category select inside `wireMapEvents`; `renderMap` already reads `mapCategory`; `mapSearch` already filters by `mapCategory`

- [ ] **Step 1: Wire the category select in wireMapEvents**

At the end of `wireMapEvents` (after the Clear button handler), append:

```js
  // Category filter.
  const cat = document.getElementById('mapCatFilter');
  if (cat) {
    cat.addEventListener('change', () => {
      mapCategory = cat.value;
      // If we're on a supplier that no longer matches the category, clear to idle.
      if (mapMode === 'supplier' && mapSelectedSupplierIdx != null) {
        const e = RAW[mapSelectedSupplierIdx];
        if (mapCategory && !(e.cats || []).includes(mapCategory)) {
          mapClear();
          return;
        }
      }
      // Re-render autocomplete if currently visible.
      if (mapQuery) renderMapAutocomplete();
      renderMap();
    });
  }
```

- [ ] **Step 2: Checkpoint**

Save, reload, click the Map tab.

Expected:
- Open the category dropdown and pick **Electric Bicycle**. Halls with zero e-bike suppliers dim further to ~15% opacity. Hover tooltip is not required.
- Type `motor` in the search → the autocomplete only includes suppliers whose categories include "Electric Bicycle."
- Click hall **E7** → the side panel header's supplier count now reads "N suppliers in 'Electric Bicycle'" and lists only matches.
- If a supplier view is active and the user changes the category such that the supplier no longer matches, the view resets to idle.
- Clearing the category from the dropdown (selecting "All categories") restores every hall to full opacity and all suppliers re-appear in search.

---

## Task 10: Cross-tab regression + polish pass

**Files:**
- Modify: `china_cycle_suppliers.html` — verification only; small polish edits as needed.

- [ ] **Step 1: Click through every tab with the map in various states**

Manually verify the following sequences in a browser:

1. Fresh load → Suppliers tab renders its full table, counts, chips, filters, and the detail slide-over (click a row).
2. Click Map tab → schematic renders, idle side panel.
3. From Map (idle), click Suppliers tab → suppliers table behaves normally. Click Map again → still idle (or whatever state it was last in — we intentionally do not tear down).
4. From Map (supplier mode for "bafang"), click Shortlist → shortlist renders normally. Click Map → supplier state is preserved.
5. From Map (hall mode E6), click Products → products render. Click Map → still E6 hall mode, in-hall filter value preserved.
6. From Map (hall mode), click Catalogs → catalogs render. Click Map again → no errors.
7. From Map (supplier mode), click "Open full supplier details →" → slide-over opens over the Map (not the Suppliers tab). Close it with the existing close control. Map state unchanged.
8. Resize the browser window narrower than 900px → the side panel stacks below the SVG. Resize wider → returns to side-by-side.
9. Shortlist counter in the nav still updates when you star something from the existing Supplier slide-over opened from Map mode.

- [ ] **Step 2: Fix any visible issues**

If any of the following are off, fix them inline (do not introduce new tasks):
- Map tab count reads `13` (hard-coded in HTML; confirm it does not get overwritten by `updateTabCounts`).
- No console errors or warnings on Map load or during interactions.
- SVG text is legible at default window width; if any hall code or name overflows its rect, adjust the font-size in CSS (not the rect size — geometry is locked).
- Colors visually distinguish the three wings at a glance.

- [ ] **Step 3: Checkpoint**

Save. Everything in the spec's "Testing" section should now pass:

1. ✅ Idle state: 13 halls + atrium in an NECC-like layout.
2. ✅ Supplier search (bafang) → E6 highlights, pin, supplier panel, details button opens slide-over.
3. ✅ Hall click (E6) → amber highlight, 191 suppliers listed, in-hall filter works.
4. ✅ Hall-code search (`E6`) → Mode 3 on E6.
5. ✅ Category filter (Electric Bicycle) → dims empty halls, filters autocomplete, restricts hall list.
6. ✅ Clear button + Esc + empty search all return to idle.
7. ✅ Cross-tab sanity — no regressions in Suppliers, Products, Shortlist, Catalogs, Discover.

---

## Self-review notes

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Map tab between Catalogs and Discover | Task 1 |
| Pure SVG, no map library | Task 4 |
| 13 halls + atrium, hand-tuned positions per shuttle-route hints | Task 3 + Task 4 |
| `HALL_META` constant with supplier counts computed from data | Task 3 |
| Three modes (idle / supplier / hall) | Tasks 4, 5, 7 |
| Supplier search autocomplete, scored (exact > prefix > substring) | Task 6 |
| Bare hall code → hall mode on Enter | Task 6 |
| Keyboard ↑/↓/Enter/Esc in search | Task 6 |
| "Open full supplier details" → `openPanel(idx)` | Task 7 |
| Side-panel swaps by mode | Task 4 + Task 5 + Task 7 |
| In-hall filter input | Task 4 + Task 5 |
| Category filter dims empty halls + restricts autocomplete | Task 9 |
| Clear button / Esc / background click → idle | Tasks 5, 6, 8 |
| Single-file; no backend / build / tests | All tasks |
| Cross-tab regression | Task 10 |
| Responsive (stack below 900px) | Task 2 |

**Naming consistency:** `mapClear`, `mapPickHall`, `mapPickSupplier`, `mapSetHallFilter`, `mapSearch`, `renderMap`, `renderMapSvg`, `renderMapSidePanel`, `renderMapAutocomplete`, `hideMapAutocomplete`, `highlightMapAcRow`, `mapClearSearch`, `hallHasCategory`, `escSvg` — all introduced exactly once and referenced by the same name throughout the plan. `HALL_META`, `HALL_CODES`, `HALL_COUNTS` are the only three new constants.

**Non-obvious decisions:**
- Task 4 introduces stubs that later tasks replace. This lets each checkpoint produce a working, bisectable intermediate state.
- Task 9 requires that `renderMap` already checks `mapCategory` — it does, because Task 4's `renderMap` calls `hallHasCategory(code, mapCategory)`. No change to `renderMap` is needed in Task 9.
- Task 7's `mapPickSupplier` refuses to select suppliers whose hall is not in `HALL_META`. The current RAW data appears to use only the 13 codes, but this guard prevents an unhighlighted "phantom" state if the data file is updated to include a hall we don't render.
