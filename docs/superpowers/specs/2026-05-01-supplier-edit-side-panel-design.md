# Supplier edit from side panel — design

## Goal

Allow the user to edit four fields of a supplier directly from the side panel
in `china_cycle_suppliers.html`:

- Brand name (`brand`)
- Booth (`booth` — comma-separated list of codes)
- Official English name (`en`)
- Official Chinese name (`cn`)

Edits must persist across page reloads in the browser, and must be exportable
so they can be folded back into the canonical CSV/JSON via `rebuild_db.py`.

## Non-goals

- Adding or deleting suppliers.
- Editing other fields (website, scope, categories, hall, halls list).
- Validating booth codes against the floor plan.
- Undo / edit history / multi-user concurrency.

## Architecture overview

Three layers, each with one job:

1. **Stable identity** — every RAW entry gets an `id` so overrides and existing
   notes/status records can be keyed reliably even when `cn` is edited.
2. **Override layer in localStorage** — instant in-browser edits. All renders
   (table, map, search, side panel) read through `getDisplayEntry(i)` which
   merges RAW with the override before returning.
3. **Export + reapply pipeline** — a toolbar button downloads
   `overrides.json`; `rebuild_db.py` reads it on next run and applies overrides
   to the canonical entries before writing the new RAW into the HTML.

```
            ┌──────────────────────┐
            │ exhibitors_official  │
            │       .json          │ ← canonical source
            └──────────┬───────────┘
                       │
         rebuild_db.py │  applies overrides.json
                       ▼
            ┌──────────────────────┐
            │     RAW (in HTML)    │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐    ┌──────────────────────────┐
            │ getDisplayEntry(i)   │ ←─ │ localStorage             │
            │ merges RAW+override  │    │   overrides:<id> = {...} │
            └──────────┬───────────┘    └──────────────────────────┘
                       │
                       ▼
              renders (table, map, panel, search)
```

## Stable identity

`exhibitors.csv` already exposes an `ID` column (`official_0`, `official_1`,
…). The HTML's RAW array drops it. We add it back.

- `rebuild_db.py` writes `id: "official_<n>"` for each official entry and
  `id: "ocr_<slug>"` (e.g. `ocr_rockbros`) for entries from `keep_ocr_only`.
  The slug is the lowercased `en` with non-alphanumeric chars replaced by
  underscores. The `keep_ocr_only` set is small and stable, so collisions are
  not a practical concern.
- One-shot localStorage migration on page load: scan existing
  `note:<cn>` and `status:<cn>` keys, look up the matching entry by `cn`, and
  rewrite them to `note:<id>` / `status:<id>`. Migration is idempotent and
  guarded by a `migrated:cn-to-id:v1` flag in localStorage.
- All localStorage helpers (`LS.getNote`, `LS.setNote`, `LS.getStatus`,
  `LS.setStatus`) are switched to take an `id` instead of `cn`. Callers are
  updated.

## Override layer

- localStorage key: `overrides:<id>`.
- Value: JSON object containing only the modified fields, e.g.
  `{"brand": "NEW BRAND", "booth": "E1-0001, E1-0003"}`. Absent fields fall
  through to RAW.
- Helper API:
  - `LS.getOverride(id)` → object or `null`.
  - `LS.setOverride(id, partial)` — merges and writes; if the merged result
    equals the RAW values for all fields, removes the key entirely so the row
    is no longer flagged as edited.
  - `LS.allOverrides()` → `{id: override}` for export.
  - `LS.clearAllOverrides()` for the "clear local edits" button.
- New helper `getDisplayEntry(i)` returns a shallow merge of `RAW[i]` with
  `LS.getOverride(RAW[i].id)`. Every read site that consumed `RAW[i]` for one
  of the four editable fields now goes through this helper (table render, map
  side panel, supplier detail panel, search index build).
- Search index rebuild: when an override changes, recompute the search index
  entry for that supplier so autocomplete reflects the new name/brand/booth.

## Side panel UX

- A single **"Modifier"** button in the panel header switches the panel into
  edit mode. In edit mode the four target sections (Brand, Booth, EN
  official, CN official) become `<input>` elements pre-filled with the
  current display value.
- Footer (only visible in edit mode):
  - **Enregistrer** (primary) — saves the diff, exits edit mode, refreshes the
    current view.
  - **Annuler** — discards changes, exits edit mode.
- Keyboard: `Esc` cancels, `Cmd/Ctrl+Enter` saves.
- Visual indicator: when a field has an active override, a small "✎ modifié"
  badge sits next to its section title in read mode. Clicking the badge in
  read mode opens edit mode focused on that field.
- Booth input is plain text. Whitespace around commas is normalised on save
  (`"E1-0001 , E1-0003 "` → `"E1-0001, E1-0003"`). No validation against the
  hall map.
- The panel header name (`panel-name` / `panel-cn`) updates immediately after
  save so the user sees the new name reflected.

## Toolbar controls

Two new buttons, placed in the existing top toolbar near the search/filter
controls:

- **Exporter les modifications** — gathers `LS.allOverrides()` into a JSON
  file `overrides.json` and triggers a download. Disabled (greyed) when no
  overrides exist; the button label shows the count, e.g. "Exporter les
  modifications (12)".
- **Effacer les modifications locales** — confirm dialog, then
  `LS.clearAllOverrides()` and refresh the view. Hidden when no overrides
  exist.

## Reapply at rebuild time

`rebuild_db.py` extension:

- After loading `exhibitors_official.json`, look for `overrides.json` at the
  repo root.
- If present:
  - For each `id` → override pair, locate the matching official entry by
    deriving the same id (`official_<n>` from positional index) and apply the
    override fields onto `name_en`, `name_cn`, `booths`, and the new RAW
    `brand` value.
  - For `ocr_<slug>` ids, locate the matching `keep_ocr_only` entry and apply
    the override.
  - Booth strings are split on `,`, trimmed, and converted back into the
    `[hall, code]` tuple list expected by the rest of the pipeline (hall is
    the prefix before the first `-`).
  - Print a summary: "Applied N overrides from overrides.json".
- The script does not delete `overrides.json` — the user decides when to
  remove it (a one-line comment in the printed summary reminds them).

## Edge cases

- Saving with all four fields equal to RAW values clears the override key (no
  zombie entries cluttering the export).
- Editing `cn` does not affect notes/status — those are now keyed by `id`.
- An override referencing an `id` that no longer exists in RAW (e.g. official
  list shifted) is kept in localStorage but ignored at render. The export
  still includes it so the user can manually reconcile. `rebuild_db.py`
  prints a warning for unmatched ids.
- The panel never enters edit mode if `panelIdx < 0`.
- Closing the panel while in edit mode prompts a confirm if there are unsaved
  changes; otherwise closes silently.

## Testing approach

Manual QA checklist (no test framework in the repo):

1. Edit each of the four fields on a supplier, save, reload page → values
   persist.
2. Edit `cn`, then add a note → note remains attached after another reload.
3. Export overrides → JSON file downloads with expected shape.
4. Drop the file at the repo root, run `rebuild_db.py` → new RAW reflects
   overrides; load page → "modifié" badges disappear after clearing local
   overrides.
5. Edit then revert all four fields back to RAW values → override key is
   removed; export button reverts to disabled.
6. Edit a supplier, switch to map view → map side panel and table both show
   the new values.
7. Type the new brand name in the search bar → autocomplete finds it.

## Files touched

- `china_cycle_suppliers.html` — RAW format, side panel HTML, panel JS
  (open/save/cancel), toolbar buttons, `LS` helpers, search index rebuild,
  one-shot migration.
- `rebuild_db.py` — emit `id` field; load and apply `overrides.json`.
- `overrides.json` — new file (created by user via export, gitignored or
  committed depending on the user's flow; default: not gitignored so it can
  travel with the repo).
