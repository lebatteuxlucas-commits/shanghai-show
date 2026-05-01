# Supplier edit from side panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user edit `brand`, `booth`, `en`, and `cn` of any supplier from the side panel; persist edits in the browser; export them as JSON; and let `rebuild_db.py` reapply the export at build time.

**Architecture:** Add a stable `id` field to every RAW entry. Store edits in localStorage as per-id overrides. Route every read of the four editable fields through a `getDisplayEntry(i)` helper that merges RAW + override. Add an "Edit" mode to the side panel and two toolbar buttons (Export / Clear local). Extend `rebuild_db.py` to consume an exported `overrides.json`.

**Tech Stack:** Vanilla JS in `china_cycle_suppliers.html` (single inline `<script>`), Python 3 in `rebuild_db.py`. No test framework — verification is manual in the browser at each checkpoint.

**Spec:** [docs/superpowers/specs/2026-05-01-supplier-edit-side-panel-design.md](../specs/2026-05-01-supplier-edit-side-panel-design.md)

---

## File map

- **Modify** `rebuild_db.py` — emit `id` field in RAW; load `overrides.json` and apply overrides before writing.
- **Modify** `china_cycle_suppliers.html` — RAW `id` field, override LS helpers, `getDisplayEntry`, panel edit mode HTML/CSS/JS, two toolbar buttons, one-shot LS migration.
- **Create** `overrides.json` — created at runtime by the user via the export button; consumed by `rebuild_db.py`.

No new files in source control until the user exports their first override.

---

## Conventions used in this plan

- Every step shows the actual code or command. No placeholders.
- After every code change there is a "Verify in browser" or "Run script" step with the exact action and expected result.
- Each task ends with a commit. Commit messages follow the existing style (`Task N: short description` — see `git log`).
- Open `china_cycle_suppliers.html` in a local server or directly via `file://` for verification (the project has no dev server).

---

## Task 1: Emit stable `id` field from `rebuild_db.py`

**Files:**
- Modify: `rebuild_db.py` — add `id` to each entry in the `raw` list.
- Side effect: `china_cycle_suppliers.html` RAW gets re-emitted with the new field.

- [ ] **Step 1: Add a slugify helper near the top of `rebuild_db.py`**

After the `HALL_NAMES_CN` dict (around line 37), add:

```python
def _slug(name: str) -> str:
    """Lowercase, alphanumerics + underscores, used for ocr_<slug> ids."""
    return re.sub(r'[^a-z0-9]+', '_', (name or '').lower()).strip('_')
```

- [ ] **Step 2: Emit `id` for official entries**

In `main()`, locate the `for o in official:` loop (around line 45). Change the `raw.append({...})` call to include an `id` derived from the positional index in the `official` list. Replace:

```python
    for o in official:
        booths = o["booths"]  # list of [hall, code]
        primary_hall = booths[0][0] if booths else ""
        booth_codes = ", ".join(f"{h}-{c}" for h, c in booths) if booths else ""
        halls = sorted({h for h, _ in booths}) if booths else []
        raw.append({
            "en":    o["name_en"],
            "cn":    o["name_cn"],
            "hall":  primary_hall,
            "hallEn": HALL_NAMES_EN.get(primary_hall, ""),
            "scope": "",
            "cats":  [],
            "website": "",
            "booth": booth_codes,
            "halls": halls,
        })
```

with:

```python
    for off_idx, o in enumerate(official):
        booths = o["booths"]  # list of [hall, code]
        primary_hall = booths[0][0] if booths else ""
        booth_codes = ", ".join(f"{h}-{c}" for h, c in booths) if booths else ""
        halls = sorted({h for h, _ in booths}) if booths else []
        raw.append({
            "id":    f"official_{off_idx}",
            "en":    o["name_en"],
            "cn":    o["name_cn"],
            "hall":  primary_hall,
            "hallEn": HALL_NAMES_EN.get(primary_hall, ""),
            "scope": "",
            "cats":  [],
            "website": "",
            "booth": booth_codes,
            "halls": halls,
        })
```

- [ ] **Step 3: Emit `id` for OCR-only entries**

In the same file, locate the `for en, (hall, cn) in keep_ocr_only.items():` loop (around line 81). Replace:

```python
        raw.append({
            "en":    en,
            "cn":    cn,
            "hall":  hall,
            "hallEn": HALL_NAMES_EN.get(hall, ""),
            "scope": "",
            "cats":  [],
            "website": "",
            "booth": "",
            "halls": [hall],
            "_src":  "floor_plan_ocr_only",
        })
```

with:

```python
        raw.append({
            "id":    f"ocr_{_slug(en)}",
            "en":    en,
            "cn":    cn,
            "hall":  hall,
            "hallEn": HALL_NAMES_EN.get(hall, ""),
            "scope": "",
            "cats":  [],
            "website": "",
            "booth": "",
            "halls": [hall],
            "_src":  "floor_plan_ocr_only",
        })
```

- [ ] **Step 4: Run the script**

Run: `python3 rebuild_db.py`
Expected output: `Loaded 1627 official entries`, `Added N OCR-only brands…`, `✓ exhibitors.csv: …`, `✓ china_cycle_suppliers.html: … bytes`.

- [ ] **Step 5: Verify ids landed in RAW**

Run: `grep -o '"id": "official_0"' china_cycle_suppliers.html | head -1` — should output `"id": "official_0"`.
Run: `grep -o '"id": "ocr_rockbros"' china_cycle_suppliers.html | head -1` — should output `"id": "ocr_rockbros"`.

- [ ] **Step 6: Commit**

```bash
git add rebuild_db.py china_cycle_suppliers.html
git commit -m "Task 1: emit stable id field on every RAW entry"
```

---

## Task 2: Add override LS helpers (no UI yet)

**Files:**
- Modify: `china_cycle_suppliers.html` — extend the `LS` object (around line 1422).

- [ ] **Step 1: Add four helpers to the `LS` object**

In `china_cycle_suppliers.html`, locate the `LS` const (around line 1422). After the `setPtagNote` line and before the closing `};`, insert:

```javascript
  // ── Supplier overrides (user edits to brand/booth/en/cn) ────────────────
  // Stored as { [id]: { brand?, booth?, en?, cn? } }. Only modified fields
  // are present; absent fields fall through to RAW at render time.
  getOverride: (id) => { const o = LS.get('overrides') || {}; return o[id] || null; },
  setOverride: (id, partial) => {
    const o = LS.get('overrides') || {};
    const merged = Object.assign({}, o[id] || {}, partial);
    // Drop keys whose value is null/undefined/empty so we can revert a field.
    for (const k of Object.keys(merged)) {
      if (merged[k] == null || merged[k] === '') delete merged[k];
    }
    if (Object.keys(merged).length === 0) delete o[id];
    else o[id] = merged;
    LS.set('overrides', o);
  },
  allOverrides: () => LS.get('overrides') || {},
  clearAllOverrides: () => LS.set('overrides', {}),
```

- [ ] **Step 2: Verify in browser**

Open `china_cycle_suppliers.html`. Open DevTools console and run:

```javascript
LS.setOverride('official_0', { brand: 'TEST' });
LS.getOverride('official_0');                        // → { brand: "TEST" }
LS.allOverrides();                                   // → { official_0: { brand: "TEST" } }
LS.setOverride('official_0', { brand: '' });         // empty string clears the field
LS.getOverride('official_0');                        // → null  (empty object dropped)
```

If any of these mismatch, fix and retry before committing.

- [ ] **Step 3: Commit**

```bash
git add china_cycle_suppliers.html
git commit -m "Task 2: add LS helpers for supplier overrides"
```

---

## Task 3: Add `getDisplayEntry(i)` and route reads through it

**Files:**
- Modify: `china_cycle_suppliers.html` — add helper, switch four read sites.

`getDisplayEntry` returns a shallow merge of `RAW[i]` and its override. We route every consumer of the four editable fields (`brand`, `booth`, `en`, `cn`) through it: the table render, the side panel, the map search index, and the in-hall filter. Other fields (hall, halls, hallEn, scope, cats, website) stay on the raw entry — they are not editable.

- [ ] **Step 1: Define `getDisplayEntry`**

Place the helper just below the `RAW.forEach(e => { e._en_lc = … })` block (around line 1276). Insert:

```javascript
// Merge RAW[i] with any user override for the four editable fields.
// Caller-safe: returns a new object, does not mutate RAW.
function getDisplayEntry(i) {
  const e = RAW[i];
  if (!e) return null;
  const ov = LS.getOverride(e.id);
  if (!ov) return e;
  return Object.assign({}, e, ov);
}
```

- [ ] **Step 2: Route the table render through it**

In the table `render()` (around line 1377), the row map currently does:

```javascript
    .map((e, i) => {
      ...
      const idx = RAW_IDX.get(e);
      ...
```

We want to display the override-merged values. Inside that `.map`, replace the line that reads `const idx = RAW_IDX.get(e);` and references to `e.brand`, `e.en`, `e.cn`, `e.booth` (e.g. `brandLine`, `<div class="co-en">`, `<div class="co-cn">`, `boothCell`) with values pulled from a `d` (display) variable:

Before the existing `const brandLine = e.brand ? …` line, add:

```javascript
      const d = getDisplayEntry(idx) || e;
```

Then replace every `e.brand`, `e.en`, `e.cn`, `e.booth` reference *inside this `.map` callback only* with `d.brand`, `d.en`, `d.cn`, `d.booth`. Leave references to `e.hall`, `e.hallEn`, `e.halls`, `e.scope`, `e.website`, `e.cats`, `e._en_lc` etc. untouched.

(If `boothCell` is computed earlier in the callback from `e.booth`, also switch it to `d.booth`.)

- [ ] **Step 3: Route the side panel through it**

In `openPanel(idx)` (around line 1529), replace:

```javascript
function openPanel(idx) {
  panelIdx = idx;
  const e = RAW[idx];
```

with:

```javascript
function openPanel(idx) {
  panelIdx = idx;
  const raw = RAW[idx];
  const e = getDisplayEntry(idx) || raw;
```

The rest of `openPanel` already reads `e.en`, `e.cn`, `e.brand`, `e.booth` — those now reflect overrides. Reads of `e.hall`, `e.halls`, `e.hallEn` still work because `getDisplayEntry` carries them through unchanged.

- [ ] **Step 4: Route the map search index build through it**

In `initMap()` (around line 1985), the `mapSearchIndex = RAW.map((e, i) => { … })` callback uses `e.en`, `e.cn`, `e.booth`, `e.brand` to populate the index. Replace the callback's first line with:

```javascript
  mapSearchIndex = RAW.map((rawE, i) => {
    const e = getDisplayEntry(i) || rawE;
    const boothLc = (e.booth || '').toLowerCase();
    ...
```

…and use `e` everywhere inside the callback as before. Make sure `enLc` falls back to `e.en.toLowerCase()` rather than the `_en_lc` cache (since the override may have changed `en`):

```javascript
      enLc: (e.en || '').toLowerCase(),
```

(replace the existing `enLc: (e._en_lc || e.en.toLowerCase())` line).

- [ ] **Step 5: Verify in browser**

Open the page. In DevTools console:

```javascript
LS.setOverride('official_0', { brand: 'OVERRIDE_TEST' });
location.reload();
// In the rendered table, find the row whose id is official_0 (top of the
// Bicycles hall table). Its brand chip should now read OVERRIDE_TEST.
LS.setOverride('official_0', { brand: '' });   // revert
location.reload();
```

Click the row → side panel should show OVERRIDE_TEST when override is active, original after revert.

- [ ] **Step 6: Commit**

```bash
git add china_cycle_suppliers.html
git commit -m "Task 3: route reads of editable fields through getDisplayEntry"
```

---

## Task 4: Switch storage keys from `cn` to `id` and migrate existing data

**Files:**
- Modify: `china_cycle_suppliers.html` — change `LS.getNote/setNote/getStatus/setStatus` signatures, update `supplierKey`, update all callers, add one-shot migration.

The existing helpers key by `cn` (notes, statuses) and `supplierKey(e)` (catalogs). Both break if the user edits `cn`. We switch them to use the stable `id` and migrate any existing localStorage data on page load.

- [ ] **Step 1: Change `supplierKey` to prefer `id`**

In `china_cycle_suppliers.html`, locate `function supplierKey(e)` (around line 1454). Replace:

```javascript
function supplierKey(e) {
  if (!e) return '';
  return e.cn || (e.en + '|' + (e.booth || ''));
}
```

with:

```javascript
function supplierKey(e) {
  if (!e) return '';
  return e.id || e.cn || (e.en + '|' + (e.booth || ''));
}
```

- [ ] **Step 2: Update `LS.getNote/setNote/getStatus/setStatus` signatures**

In the `LS` object, change the four methods to take `id` semantically (no behavior change yet — the parameter is just a key string, but rename for clarity):

```javascript
  getStatus: (id) => { const s = LS.get('statuses') || {}; return s[id] || ''; },
  setStatus: (id, v) => { const s = LS.get('statuses') || {}; if (v) s[id] = v; else delete s[id]; LS.set('statuses', s); },
  getNote: (id) => { const n = LS.get('notes') || {}; return n[id] || ''; },
  setNote: (id, txt) => { const n = LS.get('notes') || {}; if (txt) n[id] = txt; else delete n[id]; LS.set('notes', n); },
```

- [ ] **Step 3: Update callers to pass `id`**

In `openPanel` (around lines 1587 and 1592), replace:

```javascript
  const status = LS.getStatus(e.cn);
```

with:

```javascript
  const status = LS.getStatus(raw.id);
```

and:

```javascript
  document.getElementById('panel-notes').value = LS.getNote(e.cn);
```

with:

```javascript
  document.getElementById('panel-notes').value = LS.getNote(raw.id);
```

In `panelSetStatus` (around line 1605), replace:

```javascript
  const e = RAW[panelIdx];
  const val = document.getElementById('panel-status').value;
  LS.setStatus(e.cn, val);
```

with:

```javascript
  const e = RAW[panelIdx];
  const val = document.getElementById('panel-status').value;
  LS.setStatus(e.id, val);
```

In `panelSaveNote` (around line 1614), replace:

```javascript
  const e = RAW[panelIdx];
  LS.setNote(e.cn, document.getElementById('panel-notes').value.trim());
```

with:

```javascript
  const e = RAW[panelIdx];
  LS.setNote(e.id, document.getElementById('panel-notes').value.trim());
```

(Catalog and ptag callers already use `supplierKey(e)` / generic ids — they pick up the new `id` automatically through Step 1.)

- [ ] **Step 4: Add a one-shot migration**

Insert this block immediately *after* the `RAW.forEach(e => { e._en_lc = … })` block and *before* `getDisplayEntry`:

```javascript
// One-shot migration: notes/statuses/catalogs were keyed by cn (or by
// `cn || en|booth`) before stable ids existed. Re-key them to `id` so
// they survive an edit of the cn field. Idempotent — guarded by a flag.
(function migrateLegacyKeys() {
  if (LS.get('migrated_cn_to_id_v1')) return;

  // Build cn → id and (en+'|'+booth) → id lookup tables
  const byCn = new Map();
  const byLegacy = new Map();
  RAW.forEach(e => {
    if (e.cn) byCn.set(e.cn, e.id);
    byLegacy.set(e.en + '|' + (e.booth || ''), e.id);
  });

  function rekey(bucket) {
    const old = LS.get(bucket) || {};
    const next = {};
    for (const [k, v] of Object.entries(old)) {
      const id = byCn.get(k) || byLegacy.get(k) || (k.startsWith('official_') || k.startsWith('ocr_') ? k : null);
      if (id) next[id] = v;
      // else: orphan — silently dropped
    }
    LS.set(bucket, next);
  }

  rekey('notes');
  rekey('statuses');
  rekey('catalogs');
  LS.set('migrated_cn_to_id_v1', true);
})();
```

- [ ] **Step 5: Verify migration in browser**

Open DevTools console *before* reloading:

```javascript
// Seed legacy data
const cn0 = RAW[0].cn;
localStorage.setItem('fm_notes', JSON.stringify({ [cn0]: 'legacy note' }));
localStorage.setItem('fm_statuses', JSON.stringify({ [cn0]: 'shortlist' }));
localStorage.removeItem('fm_migrated_cn_to_id_v1');
location.reload();
```

After reload:

```javascript
LS.getNote('official_0');     // → "legacy note"
LS.getStatus('official_0');   // → "shortlist"
LS.get('migrated_cn_to_id_v1');  // → true
```

Open the panel for the first row (Bicycles hall, JAK) — the note and "Shortlist" status should be displayed.

- [ ] **Step 6: Commit**

```bash
git add china_cycle_suppliers.html
git commit -m "Task 4: re-key notes/statuses/catalogs by stable id, migrate legacy data"
```

---

## Task 5: Side panel edit mode HTML + CSS

**Files:**
- Modify: `china_cycle_suppliers.html` — add edit mode UI scaffolding (header button, hidden footer, hidden inputs in each section).

This task only adds the static markup and styles. JS wiring is Task 6.

- [ ] **Step 1: Add CSS rules for edit mode**

Locate the `.panel-site a:hover` rule (around line 627) and append the following block right after it:

```css
  /* ── Edit mode (side panel) ───────────────────────────────────────────── */
  .panel-edit-toggle {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--mid);
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 8px;
  }
  .panel-edit-toggle:hover { color: var(--dark); border-color: var(--dark); }
  .panel-edit-input {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    color: var(--dark);
  }
  .panel-edit-input:focus { outline: none; border-color: var(--teal); }
  .panel-edit-footer {
    position: sticky;
    bottom: 0;
    background: #fff;
    border-top: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .panel-edit-save {
    background: var(--teal);
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .panel-edit-save:hover { background: var(--teal-dark); }
  .panel-edit-cancel {
    background: transparent;
    color: var(--mid);
    border: 1px solid var(--border);
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
  }
  .panel-edit-cancel:hover { color: var(--dark); border-color: var(--dark); }
  .panel-edited-badge {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 3px;
    background: #fff7e0;
    color: #8a6d00;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
  }
  .panel-edited-badge:hover { background: #ffe9a0; }
  /* When the panel is in edit mode, hide read-mode displays and show inputs */
  .detail-panel.editing .panel-edit-readonly { display: none; }
  .detail-panel:not(.editing) .panel-edit-input-wrap { display: none; }
  .detail-panel:not(.editing) .panel-edit-footer { display: none; }
  .detail-panel.editing .panel-edit-toggle { display: none; }
```

- [ ] **Step 2: Add the "Modifier" button to the panel header**

Locate the `panel-header` div (around line 1130). Replace:

```html
<div class="panel-header">
    <div style="flex:1">
      <div class="panel-name" id="panel-name"></div>
      <div class="panel-cn" id="panel-cn"></div>
    </div>
    <button class="panel-close" onclick="closePanel()">✕</button>
  </div>
```

with:

```html
<div class="panel-header">
    <div style="flex:1">
      <div class="panel-name" id="panel-name"></div>
      <div class="panel-cn" id="panel-cn"></div>
    </div>
    <button class="panel-edit-toggle" type="button" onclick="panelEnterEditMode()">Modifier</button>
    <button class="panel-close" onclick="closePanel()">✕</button>
  </div>
```

- [ ] **Step 3: Add edit input wrappers to the four editable sections**

The four target sections are Brand, Booth, and we need to add EN/CN sections (currently the EN/CN names live in the panel header, not in panel-body sections). We add inputs as siblings of the existing read-mode displays, each wrapped in a `.panel-edit-input-wrap`.

All four sections must stay visible in both read and edit modes (so the title + badge act as the affordance). We restructure each to have a read-only display div *and* an input wrap as siblings; CSS toggles which one shows.

In `#panel-brand-wrap`, replace:

```html
<div class="panel-section" id="panel-brand-wrap" style="display:none">
      <div class="panel-section-title">Brand</div>
      <div id="panel-brand"></div>
    </div>
```

with:

```html
<div class="panel-section" id="panel-brand-wrap">
      <div class="panel-section-title">Brand <span class="panel-edited-badge" id="panel-brand-badge" style="display:none" onclick="panelEnterEditMode('brand')">✎ modifié</span></div>
      <div class="panel-edit-readonly" id="panel-brand"></div>
      <div class="panel-edit-input-wrap"><input type="text" class="panel-edit-input" id="panel-brand-input"></div>
    </div>
```

In `#panel-booth-wrap`, replace:

```html
<div class="panel-section" id="panel-booth-wrap" style="display:none">
      <div class="panel-section-title">Booth</div>
      <div id="panel-booth"></div>
    </div>
```

with:

```html
<div class="panel-section" id="panel-booth-wrap">
      <div class="panel-section-title">Booth <span class="panel-edited-badge" id="panel-booth-badge" style="display:none" onclick="panelEnterEditMode('booth')">✎ modifié</span></div>
      <div class="panel-edit-readonly" id="panel-booth"></div>
      <div class="panel-edit-input-wrap"><input type="text" class="panel-edit-input" id="panel-booth-input" placeholder="E1-0001, E1-0003"></div>
    </div>
```

Add two new sections (EN and CN) directly *after* `panel-booth-wrap`:

```html
<div class="panel-section" id="panel-en-wrap">
      <div class="panel-section-title">Official English name <span class="panel-edited-badge" id="panel-en-badge" style="display:none" onclick="panelEnterEditMode('en')">✎ modifié</span></div>
      <div class="panel-edit-readonly" id="panel-en"></div>
      <div class="panel-edit-input-wrap"><input type="text" class="panel-edit-input" id="panel-en-input"></div>
    </div>
    <div class="panel-section" id="panel-cn-wrap">
      <div class="panel-section-title">Official Chinese name <span class="panel-edited-badge" id="panel-cn-badge" style="display:none" onclick="panelEnterEditMode('cn')">✎ modifié</span></div>
      <div class="panel-edit-readonly" id="panel-cn-readonly"></div>
      <div class="panel-edit-input-wrap"><input type="text" class="panel-edit-input" id="panel-cn-input"></div>
    </div>
```

(`panel-cn-readonly` uses a different id than the existing header `panel-cn` to avoid id collision.)

- [ ] **Step 4: Add the edit footer at the bottom of panel-body**

Locate the closing `</div>` of `<div class="panel-body">` (around line 1170, just before `</div>` that closes `detailPanel`). Insert before that closing tag:

```html
<div class="panel-edit-footer">
      <button type="button" class="panel-edit-cancel" onclick="panelExitEditMode(false)">Annuler</button>
      <button type="button" class="panel-edit-save" onclick="panelSaveEdits()">Enregistrer</button>
    </div>
```

- [ ] **Step 5: Verify HTML is well-formed**

Open `china_cycle_suppliers.html` in the browser. Click any supplier row → side panel opens, "Modifier" button visible in the header, footer not visible (because `.detail-panel.editing` class isn't applied). The page should render without console errors.

- [ ] **Step 6: Commit**

```bash
git add china_cycle_suppliers.html
git commit -m "Task 5: side panel edit mode HTML and CSS scaffolding"
```

---

## Task 6: Wire side panel edit mode JS

**Files:**
- Modify: `china_cycle_suppliers.html` — add four functions (`panelEnterEditMode`, `panelExitEditMode`, `panelSaveEdits`, helpers), keyboard shortcuts, badge sync.

- [ ] **Step 1: Add the edit-mode functions**

In `china_cycle_suppliers.html`, locate `function panelSaveNote()` (around line 1614). After its closing `}`, insert:

```javascript
// ── Side panel edit mode ────────────────────────────────────────────────────
let panelEditing = false;
let panelEditDirty = false;

function panelEnterEditMode(focusField) {
  if (panelIdx < 0) return;
  const raw = RAW[panelIdx];
  const e = getDisplayEntry(panelIdx) || raw;

  document.getElementById('panel-brand-input').value = e.brand || '';
  document.getElementById('panel-booth-input').value = e.booth || '';
  document.getElementById('panel-en-input').value    = e.en    || '';
  document.getElementById('panel-cn-input').value    = e.cn    || '';

  document.getElementById('detailPanel').classList.add('editing');
  panelEditing = true;
  panelEditDirty = false;

  // Track dirtiness so closePanel can prompt the user.
  ['brand', 'booth', 'en', 'cn'].forEach(f => {
    document.getElementById('panel-' + f + '-input').addEventListener('input', _markDirty);
  });

  const focusEl = document.getElementById('panel-' + (focusField || 'brand') + '-input');
  if (focusEl) { focusEl.focus(); focusEl.select(); }
}

function _markDirty() { panelEditDirty = true; }

function panelExitEditMode(saved) {
  document.getElementById('detailPanel').classList.remove('editing');
  panelEditing = false;
  panelEditDirty = false;
  ['brand', 'booth', 'en', 'cn'].forEach(f => {
    document.getElementById('panel-' + f + '-input').removeEventListener('input', _markDirty);
  });
  if (!saved) return;
  // Re-render the panel body to pick up the new values.
  openPanel(panelIdx);
  // Refresh the active list view (table / map) so changes propagate.
  refreshCurrentView();
}

function _normaliseBoothString(s) {
  return (s || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .join(', ');
}

function panelSaveEdits() {
  if (panelIdx < 0) return;
  const raw = RAW[panelIdx];
  const newVals = {
    brand: document.getElementById('panel-brand-input').value.trim(),
    booth: _normaliseBoothString(document.getElementById('panel-booth-input').value),
    en:    document.getElementById('panel-en-input').value.trim(),
    cn:    document.getElementById('panel-cn-input').value.trim(),
  };
  // Build the partial: only fields that differ from RAW are kept; fields that
  // match RAW are sent as '' so setOverride drops them (revert behavior).
  const partial = {};
  for (const k of ['brand', 'booth', 'en', 'cn']) {
    partial[k] = (newVals[k] === (raw[k] || '')) ? '' : newVals[k];
  }
  LS.setOverride(raw.id, partial);

  // If the map search index has been built, rebuild the affected entry.
  if (typeof mapSearchIndex !== 'undefined' && mapSearchIndex && mapSearchIndex[panelIdx]) {
    const d = getDisplayEntry(panelIdx);
    const boothCodes = (d.booth || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    mapSearchIndex[panelIdx] = Object.assign({}, mapSearchIndex[panelIdx], {
      en: d.en, enLc: (d.en || '').toLowerCase(),
      cn: d.cn || '',
      booth: d.booth || '', boothLc: (d.booth || '').toLowerCase(), boothCodes,
      brand: d.brand || '', brandLc: (d.brand || '').toLowerCase(),
    });
  }

  showToast('Modifications enregistrées');
  panelExitEditMode(true);
}
```

- [ ] **Step 2: Update `closePanel` to prompt on dirty edits**

Locate `function closePanel()` (around line 1599). Replace:

```javascript
function closePanel() {
  document.getElementById('detailPanel').classList.remove('editing');
  panelEditing = false;
  panelEditDirty = false;
  document.getElementById('detailPanel').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  panelIdx = -1;
}
```

(If the function is currently shorter, replace the entirety of it with the above. The new body must include the editing-mode reset in addition to the original close-panel behavior.)

Original was:

```javascript
function closePanel() {
  document.getElementById('detailPanel').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  panelIdx = -1;
}
```

So the actual new body is:

```javascript
function closePanel() {
  if (panelEditing && panelEditDirty) {
    if (!confirm('Modifications non enregistrées. Fermer quand même ?')) return;
  }
  document.getElementById('detailPanel').classList.remove('editing');
  panelEditing = false;
  panelEditDirty = false;
  document.getElementById('detailPanel').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  panelIdx = -1;
}
```

- [ ] **Step 3: Add keyboard shortcuts**

At the very end of the `<script>` block (search for the last `</script>` near the bottom of the file), just before that closing tag, add:

```javascript
document.addEventListener('keydown', (ev) => {
  if (!panelEditing) return;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    if (!panelEditDirty || confirm('Annuler les modifications non enregistrées ?')) {
      panelExitEditMode(false);
    }
  } else if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
    ev.preventDefault();
    panelSaveEdits();
  }
});
```

- [ ] **Step 4: Verify in browser**

Open `china_cycle_suppliers.html`. Click the first row (JAK / LANXI JIEKE). Click "Modifier".
- Inputs appear pre-filled with current values, footer visible, "Modifier" button hidden.
- Change `brand` to `JAK_TEST`, click "Enregistrer". Toast appears, panel re-renders showing new brand. Reload page → new brand still shown.
- Click "Modifier" again, revert brand to `JAK`, save. Reload → original shown, override key gone:
  ```javascript
  LS.getOverride('official_0');   // → null
  ```
- Click "Modifier", change something, press Esc → confirm dialog, then exit edit mode without saving.
- Click "Modifier", change something, press Cmd/Ctrl+Enter → saves.
- Click "Modifier", change something, click ✕ → confirm dialog about unsaved changes.

- [ ] **Step 5: Commit**

```bash
git add china_cycle_suppliers.html
git commit -m "Task 6: wire side panel edit mode (toggle, save, cancel, kbd)"
```

---

## Task 7: Show "modifié" badges in read mode

**Files:**
- Modify: `china_cycle_suppliers.html` — extend `openPanel` to toggle the four badges based on the override state.

- [ ] **Step 1: Stop hiding wraps; populate new read-only divs; add badge sync**

In `openPanel(idx)`, the existing code hides `panel-brand-wrap` and `panel-booth-wrap` when their value is empty. With the new edit-mode markup we keep the wraps always visible, fill the read-only div with the value or `—`, and populate the two new EN/CN read-only divs.

Replace the existing brand block (around line 1538):

```javascript
  const brandWrap = document.getElementById('panel-brand-wrap');
  const brandEl   = document.getElementById('panel-brand');
  if (e.brand) {
    brandEl.innerHTML = '<span class="co-brand">' + esc(e.brand) + '</span>';
    brandWrap.style.display = '';
  } else { brandWrap.style.display = 'none'; }
```

with:

```javascript
  const brandEl = document.getElementById('panel-brand');
  brandEl.innerHTML = e.brand
    ? '<span class="co-brand">' + esc(e.brand) + '</span>'
    : '<span class="no-val">—</span>';
```

Replace the existing booth block (around line 1568):

```javascript
  const boothWrap = document.getElementById('panel-booth-wrap');
  const boothEl   = document.getElementById('panel-booth');
  if (e.booth) {
    boothEl.innerHTML = e.booth.split(',').map(b =>
      '<code class="booth-code">'+esc(b.trim())+'</code>'
    ).join(' ');
    boothWrap.style.display = '';
  } else { boothWrap.style.display = 'none'; }
```

with:

```javascript
  const boothEl = document.getElementById('panel-booth');
  boothEl.innerHTML = e.booth
    ? e.booth.split(',').map(b => '<code class="booth-code">'+esc(b.trim())+'</code>').join(' ')
    : '<span class="no-val">—</span>';
```

Just below that booth block, populate the new EN and CN read-only divs:

```javascript
  document.getElementById('panel-en').textContent          = e.en || '—';
  document.getElementById('panel-cn-readonly').textContent = e.cn || '—';
```

Just before `document.getElementById('detailPanel').classList.add('open');` (around line 1590), insert the badge sync:

```javascript
  // Toggle "✎ modifié" badges based on which fields are overridden.
  const ov = LS.getOverride(raw.id) || {};
  for (const f of ['brand', 'booth', 'en', 'cn']) {
    const badge = document.getElementById('panel-' + f + '-badge');
    if (badge) badge.style.display = (f in ov) ? '' : 'none';
  }
  // Always start in read mode (in case the previous panel was closed mid-edit)
  document.getElementById('detailPanel').classList.remove('editing');
```

- [ ] **Step 2: Verify in browser**

Reload the page. Open any supplier panel. Click "Modifier", change `brand`, save. The Brand section title should now show the "✎ modifié" badge. Click the badge → re-enters edit mode focused on the brand input. Revert and save → badge disappears.

- [ ] **Step 3: Commit**

```bash
git add china_cycle_suppliers.html
git commit -m "Task 7: show ✎ modifié badges for overridden fields"
```

---

## Task 8: Toolbar export + clear-local buttons

**Files:**
- Modify: `china_cycle_suppliers.html` — add two buttons to the main toolbar with handlers.

- [ ] **Step 1: Add the buttons to the toolbar HTML**

Locate the `<div class="controls">` block (around line 1024). After the closing `</div>` of `count-pill` and before the closing `</div>` of `controls`, append:

```html
<button type="button" id="exportEditsBtn" class="map-clear" onclick="exportOverrides()" style="display:none">Exporter les modifications</button>
    <button type="button" id="clearEditsBtn" class="map-clear" onclick="clearOverrides()" style="display:none" title="Efface toutes les modifications locales">Effacer les modifications locales</button>
```

(We reuse the existing `.map-clear` button class for visual consistency. The buttons start hidden; they appear when at least one override exists.)

- [ ] **Step 2: Add the handlers and visibility sync**

In `china_cycle_suppliers.html`, near the bottom of the `<script>` block (just before the keyboard handler added in Task 6), insert:

```javascript
function _syncEditButtons() {
  const count = Object.keys(LS.allOverrides()).length;
  const exp = document.getElementById('exportEditsBtn');
  const clr = document.getElementById('clearEditsBtn');
  if (!exp || !clr) return;
  if (count > 0) {
    exp.style.display = '';
    exp.textContent = `Exporter les modifications (${count})`;
    clr.style.display = '';
  } else {
    exp.style.display = 'none';
    clr.style.display = 'none';
  }
}

function exportOverrides() {
  const data = LS.allOverrides();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'overrides.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exporté ${Object.keys(data).length} modification(s)`);
}

function clearOverrides() {
  const count = Object.keys(LS.allOverrides()).length;
  if (count === 0) return;
  if (!confirm(`Effacer ${count} modification(s) locale(s) ? Cette action est irréversible.`)) return;
  LS.clearAllOverrides();
  _syncEditButtons();
  refreshCurrentView();
  showToast('Modifications locales effacées');
}

// Initial sync once the DOM is ready.
_syncEditButtons();
```

- [ ] **Step 3: Sync buttons after every save / revert**

In `panelSaveEdits` (Task 6), at the very end (after `panelExitEditMode(true);`), add:

```javascript
  _syncEditButtons();
```

So the function ends with:

```javascript
  showToast('Modifications enregistrées');
  panelExitEditMode(true);
  _syncEditButtons();
}
```

- [ ] **Step 4: Verify in browser**

Reload. With no overrides, neither button should be visible.
Open the first row, click "Modifier", change brand, save. The "Exporter les modifications (1)" and "Effacer…" buttons should appear in the header toolbar.
Click "Exporter les modifications" → `overrides.json` is downloaded. Open it in a text editor — it should look like:

```json
{
  "official_0": { "brand": "JAK_TEST" }
}
```

Click "Effacer les modifications locales" → confirm → buttons hide, brand reverts to original everywhere.

- [ ] **Step 5: Commit**

```bash
git add china_cycle_suppliers.html
git commit -m "Task 8: toolbar buttons to export and clear local overrides"
```

---

## Task 9: Make `rebuild_db.py` apply `overrides.json`

**Files:**
- Modify: `rebuild_db.py` — read `overrides.json` if present, apply by id before writing.

- [ ] **Step 1: Add the loader and applier**

Open `rebuild_db.py`. Just below the `_slug` helper added in Task 1, add:

```python
def load_overrides(root: Path):
    """Load overrides.json if it exists. Returns dict[id, dict[field, value]]."""
    f = root / "overrides.json"
    if not f.exists():
        return {}
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"⚠ Could not parse overrides.json: {e}")
        return {}
    if not isinstance(data, dict):
        print("⚠ overrides.json is not a JSON object — ignoring")
        return {}
    return data


def _booth_str_to_pairs(s: str):
    """'E1-0001, E1-0003' → [['E1','0001'], ['E1','0003']]."""
    out = []
    for chunk in (s or "").split(","):
        c = chunk.strip()
        if not c or "-" not in c:
            continue
        hall, code = c.split("-", 1)
        out.append([hall.strip(), code.strip()])
    return out
```

- [ ] **Step 2: Apply overrides to official entries before building RAW**

In `main()`, immediately after `official = json.loads(OFF.read_text(encoding="utf-8"))` (around line 40), insert:

```python
    overrides = load_overrides(ROOT)
    applied = 0
    unmatched = []

    for off_idx, o in enumerate(official):
        ov = overrides.get(f"official_{off_idx}")
        if not ov:
            continue
        if "en" in ov:
            o["name_en"] = ov["en"]
        if "cn" in ov:
            o["name_cn"] = ov["cn"]
        if "booth" in ov:
            o["booths"] = _booth_str_to_pairs(ov["booth"])
        # `brand` is a RAW-only field; we stash it on the official entry so
        # the RAW build step can pick it up.
        if "brand" in ov:
            o["_override_brand"] = ov["brand"]
        applied += 1
```

- [ ] **Step 3: Use the override brand when building RAW**

Inside the official `for off_idx, o in enumerate(official):` loop (modified in Task 1), set the `brand` field if `_override_brand` was stashed. Replace:

```python
        raw.append({
            "id":    f"official_{off_idx}",
            "en":    o["name_en"],
            "cn":    o["name_cn"],
            "hall":  primary_hall,
            "hallEn": HALL_NAMES_EN.get(primary_hall, ""),
            "scope": "",
            "cats":  [],
            "website": "",
            "booth": booth_codes,
            "halls": halls,
        })
```

with:

```python
        entry = {
            "id":    f"official_{off_idx}",
            "en":    o["name_en"],
            "cn":    o["name_cn"],
            "hall":  primary_hall,
            "hallEn": HALL_NAMES_EN.get(primary_hall, ""),
            "scope": "",
            "cats":  [],
            "website": "",
            "booth": booth_codes,
            "halls": halls,
        }
        if "_override_brand" in o:
            entry["brand"] = o["_override_brand"]
        raw.append(entry)
```

- [ ] **Step 4: Apply OCR-only overrides**

In the OCR loop (around line 81 after the Task 1 edit), apply overrides keyed by `ocr_<slug>`. Replace:

```python
    for en, (hall, cn) in keep_ocr_only.items():
        if en in official_en_set:
            continue
        raw.append({
            "id":    f"ocr_{_slug(en)}",
            "en":    en,
            "cn":    cn,
            "hall":  hall,
            ...
        })
        added_ocr += 1
```

with:

```python
    for en, (hall, cn) in keep_ocr_only.items():
        if en in official_en_set:
            continue
        ov_id = f"ocr_{_slug(en)}"
        ov = overrides.get(ov_id)
        if ov:
            applied += 1
            en_eff = ov.get("en", en)
            cn_eff = ov.get("cn", cn)
            booth_eff = ov.get("booth", "")
            booths_pairs = _booth_str_to_pairs(booth_eff)
            primary_hall = booths_pairs[0][0] if booths_pairs else hall
            halls_eff = sorted({h for h, _ in booths_pairs}) if booths_pairs else [hall]
        else:
            en_eff, cn_eff, booth_eff = en, cn, ""
            primary_hall = hall
            halls_eff = [hall]
        entry = {
            "id":    ov_id,
            "en":    en_eff,
            "cn":    cn_eff,
            "hall":  primary_hall,
            "hallEn": HALL_NAMES_EN.get(primary_hall, ""),
            "scope": "",
            "cats":  [],
            "website": "",
            "booth": booth_eff,
            "halls": halls_eff,
            "_src":  "floor_plan_ocr_only",
        }
        if ov and "brand" in ov:
            entry["brand"] = ov["brand"]
        raw.append(entry)
        added_ocr += 1
```

- [ ] **Step 5: Report unmatched ids and applied count**

Right before `print(f"✓ exhibitors.csv: …")`, add:

```python
    # Detect unmatched override ids (exist in overrides.json but no matching RAW entry)
    raw_ids = {r["id"] for r in raw}
    for ov_id in overrides:
        if ov_id not in raw_ids:
            unmatched.append(ov_id)
    if overrides:
        print(f"Applied {applied} override(s) from overrides.json")
        if unmatched:
            print(f"⚠ {len(unmatched)} override id(s) had no matching RAW entry: {', '.join(unmatched[:5])}{'…' if len(unmatched) > 5 else ''}")
        print("  (overrides.json was not deleted — remove it manually once edits are committed upstream)")
```

- [ ] **Step 6: Round-trip test**

In the project root:

```bash
# 1. Start clean
rm -f overrides.json
# 2. Open the page, edit any supplier (e.g. official_0: change brand to TEST_BRAND, booth to E1-9999, en to TEST_EN, cn to 测试)
# 3. Click "Exporter les modifications" → moves overrides.json to repo root
mv ~/Downloads/overrides.json .
# 4. Re-run the build
python3 rebuild_db.py
# Expected: "Applied 1 override(s) from overrides.json" line in output.
# 5. Reload the page. Click "Effacer les modifications locales" so local
#    overrides don't double-apply.
# 6. Open the same supplier — should show TEST_BRAND / E1-9999 / TEST_EN / 测试
#    coming from RAW (no badge, since no local override).
# 7. Cleanup
rm -f overrides.json
python3 rebuild_db.py    # rebuilds without overrides
```

- [ ] **Step 7: Commit**

```bash
git add rebuild_db.py
git commit -m "Task 9: rebuild_db.py applies overrides.json to canonical source"
```

---

## Task 10: End-to-end QA pass

This is a manual checklist. No code changes; if any item fails, file the bug as a follow-up commit on the appropriate task above.

- [ ] **Step 1: Persistence across reloads**
Edit `brand`, `booth`, `en`, `cn` for one supplier. Reload the page (Cmd+R). All four fields show the new values; "✎ modifié" badges appear next to all four section titles.

- [ ] **Step 2: Notes survive a `cn` edit**
Open a different supplier (`official_5`). Type a note ("important — call back"), Save note. Then click "Modifier", change `cn` to `测试 CN 2`, save. Reload. The note is still attached to the supplier, even though `cn` changed.

- [ ] **Step 3: Map view reflects edits**
Switch to the Map tab. The map side panel for the edited supplier shows the new values. Type the new brand name in the map search → autocomplete finds it.

- [ ] **Step 4: Table view reflects edits**
Switch back to the directory view. The row for the edited supplier shows the new brand banner, EN name, CN name, and booth codes.

- [ ] **Step 5: Revert clears overrides**
For one supplier, edit then revert all four fields back to their original values, save. Confirm:
```javascript
LS.getOverride('<that-supplier-id>')   // → null
```
The "Exporter les modifications (N)" count drops by one.

- [ ] **Step 6: Export shape**
Click "Exporter les modifications" → open the downloaded `overrides.json` in a text editor. It should be `{ id: { brand?, booth?, en?, cn? } }`, only with edited fields, no extras.

- [ ] **Step 7: Reapply round-trip**
Move `overrides.json` to the repo root, run `python3 rebuild_db.py`. The script prints `Applied N override(s)`. Reload the page, click "Effacer les modifications locales", confirm. The edited values are now the displayed values (because they came from RAW), and no badges show.

- [ ] **Step 8: Edit a multi-booth entry**
Find a supplier with multiple booth codes (e.g. one whose existing booth field contains `,`). Edit it: add a third code, save. Reload → all three pills appear. The booth string is normalised (single space after each comma, no trailing whitespace).

- [ ] **Step 9: Cancel discards changes**
Open a supplier, click "Modifier", change all four fields, click "Annuler". Panel returns to read mode, no override saved (`LS.getOverride(id)` is `null`).

- [ ] **Step 10: Esc + Cmd+Enter**
Open a supplier, click "Modifier", type something in the brand input, press `Esc` → confirm dialog, then exit. Click "Modifier" again, type something, press `Cmd+Enter` (Mac) or `Ctrl+Enter` (Linux/Win) → saves and exits edit mode.

- [ ] **Step 11: Edit an OCR-only entry**
Open one of the OCR-only entries (e.g. ROCKBROS — search for "ROCKBROS" in the directory). Its panel id should be `ocr_rockbros`. Edit `cn` to `洛克兄弟 改`, save. Confirm:
```javascript
LS.getOverride('ocr_rockbros')   // → { cn: "洛克兄弟 改" }
```
Export → check `ocr_rockbros` is in the JSON. Apply via `rebuild_db.py` → confirm the script applies it (`Applied 1 override(s)`).

- [ ] **Step 12: Final commit (no code, just a marker)**
If all 11 checks above passed, no commit is needed. If any check failed, follow the test plan in the spec to identify and fix the regression.

---

## Self-review notes

- **Spec coverage:** All four editable fields, persistence, export, reapply, badges, migration, OCR-only handling, and the keyboard shortcuts from the spec are covered by Tasks 1–9. Task 10 corresponds to the spec's "Testing approach" checklist.
- **Type consistency:** Override keys (`brand`, `booth`, `en`, `cn`), input ids (`panel-<field>-input`), badge ids (`panel-<field>-badge`), and id format (`official_<n>`, `ocr_<slug>`) are consistent across all tasks.
- **Out of scope (per spec):** No add/delete supplier, no website/scope/cats/hall edits, no booth validation, no undo history.
