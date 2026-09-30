#!/usr/bin/env python3
"""
Génère la page de revue partageable (artifact claude.ai) :
  data/review/online/index.html  +  data/review/online/sheets/*.jpg
Données injectées : unmatched.json (PDF sans exposant, candidats), sheets.json
(position des vignettes), index compact des 1 633 exposants pour la recherche.
Les décisions sont enregistrées dans la base partagée de la page (capability db),
collection « decisions », une fiche par PDF (clé = item.key).
"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]; ON = ROOT / "data/review/online"
sys.path.insert(0, str(ROOT / "scripts/websites")); from guess_domains import load_raw

items = json.loads((ON / "unmatched.json").read_text())
sheets = json.loads((ON / "sheets.json").read_text()) if (ON / "sheets.json").exists() else {"w": 240, "h": 320, "pos": {}}
index = [{"id": e["id"], "en": e["en"], "cn": e.get("cn", ""), "brand": e.get("brand", ""), "hall": e["hall"], "booth": e.get("booth", "")} for e in load_raw()]
for it in items:
    it["thumb"] = sheets["pos"].get(it["key"])
    it.pop("size_kb", None)

HTML = r'''<title>Catalogue Matching</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap">
<style>
/* Layout : en-tête collant (progression + filtres), puis une carte par PDF : vignette à gauche, décision à droite. */
:root {
  --bg: #F4F5F6; --card: #FFFFFF; --fg: #1E262B; --mid: #5A6770; --line: #DCE1E5; --line-strong: #B9C2C8;
  --slate: #495C68; --slate-fg: #FFFFFF; --green: #009A6F; --green-soft: #E0F3EC; --green-fg: #0F6B49;
  --warn-soft: #FDF1DC; --warn-fg: #8A5A00; --skip-soft: #ECEFF1; --thumb-bg: #E9ECEE; --focus: #009A6F;
  --display: 'Barlow Condensed', 'Arial Narrow', sans-serif; --body: 'DM Sans', system-ui, sans-serif; --mono: 'DM Mono', ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #171C1F; --card: #1F2629; --fg: #EEF0F2; --mid: #A5AFB6; --line: #2E373C; --line-strong: #46525A; --slate: #2A353C; --slate-fg: #EEF0F2;
  --green: #2FB57F; --green-soft: #17362A; --green-fg: #7FE0B4; --warn-soft: #3A2E12; --warn-fg: #F0C36A; --skip-soft: #2A3136; --thumb-bg: #2A3136; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #171C1F; --card: #1F2629; --fg: #EEF0F2; --mid: #A5AFB6; --line: #2E373C; --line-strong: #46525A; --slate: #2A353C; --slate-fg: #EEF0F2;
  --green: #2FB57F; --green-soft: #17362A; --green-fg: #7FE0B4; --warn-soft: #3A2E12; --warn-fg: #F0C36A; --skip-soft: #2A3136; --thumb-bg: #2A3136; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--body); font-size: 14px; line-height: 1.5; margin: 0; }
button, input, textarea { font: inherit; color: inherit; }
.top { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--slate); color: var(--slate-fg); padding-block: 12px; padding-inline: 16px; }
.top-in { max-width: 1180px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 10px 20px; align-items: center; }
h1 { font-family: var(--display); font-weight: 700; font-size: 24px; letter-spacing: 0.3px; margin: 0; text-wrap: balance; }
.sub { font-size: 12px; opacity: 0.8; }
.progress { display: flex; align-items: center; gap: 10px; font-family: var(--mono); font-size: 12px; font-variant-numeric: tabular-nums; }
.bar { width: 160px; height: 6px; background: rgba(255,255,255,0.18); border-radius: 3px; overflow: hidden; }
.bar > i { display: block; height: 100%; background: var(--green); width: 0; transition: width .3s; }
.tools { max-width: 1180px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding-top: 10px; }
.chip { border: 1px solid rgba(255,255,255,0.28); background: transparent; color: var(--slate-fg); border-radius: 999px; padding: 4px 12px; cursor: pointer; font-size: 12px; }
.chip[aria-pressed="true"] { background: var(--green); border-color: var(--green); color: #fff; }
.chip b { font-family: var(--mono); font-weight: 500; margin-left: 4px; opacity: 0.9; }
.search { flex: 1 1 220px; min-width: 0; border: 1px solid rgba(255,255,255,0.28); background: rgba(255,255,255,0.08); color: var(--slate-fg); border-radius: 6px; padding: 6px 10px; }
.search::placeholder { color: rgba(255,255,255,0.55); }
.banner { max-width: 1180px; margin: 12px auto 0; padding-inline: 16px; }
.note { background: var(--warn-soft); color: var(--warn-fg); border-radius: 6px; padding: 8px 12px; font-size: 13px; }
main { max-width: 1180px; margin: 0 auto; padding-block: 12px 48px; padding-inline: 16px; display: grid; gap: 12px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 16px; padding: 14px; }
.card.done { border-color: var(--green); }
.card.skipped { opacity: 0.75; }
.thumb-wrap { display: flex; flex-direction: column; gap: 6px; }
.thumb { width: 180px; height: 240px; background-color: var(--thumb-bg); background-repeat: no-repeat; background-size: 900px 960px; background-position: calc(var(--tx) * -0.75) calc(var(--ty) * -0.75); border-radius: 4px; border: 1px solid var(--line); }
.thumb.none { display: grid; place-items: center; color: var(--mid); font-size: 12px; }
.file { font-weight: 600; word-break: break-word; }
.meta { color: var(--mid); font-size: 12px; font-family: var(--mono); word-break: break-word; }
.ocr { font-size: 12px; color: var(--mid); margin-top: 4px; }
.ocr span { color: var(--fg); }
.guess { display: inline-block; font-family: var(--mono); font-size: 11px; background: var(--skip-soft); border-radius: 4px; padding: 1px 6px; margin-top: 4px; }
.cands { display: grid; gap: 6px; margin-top: 10px; }
.cand { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 10px; align-items: start; text-align: left; border: 1px solid var(--line); background: transparent; border-radius: 6px; padding: 8px 10px; cursor: pointer; }
.cand:hover { border-color: var(--line-strong); }
.cand[aria-pressed="true"] { border-color: var(--green); background: var(--green-soft); }
.cand .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-strong); margin-top: 3px; }
.cand[aria-pressed="true"] .dot { border-color: var(--green); background: var(--green); }
.cand .brand { font-family: var(--mono); font-size: 11px; color: var(--green-fg); font-weight: 500; }
.cand .en { font-weight: 500; }
.cand .cn { color: var(--mid); font-size: 12px; }
.cand .where { font-family: var(--mono); font-size: 11px; color: var(--mid); white-space: nowrap; }
.score { font-family: var(--mono); font-size: 10px; color: var(--mid); }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
.btn { border: 1px solid var(--line-strong); background: transparent; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
.btn:hover { border-color: var(--fg); }
.btn[aria-pressed="true"] { background: var(--slate); color: var(--slate-fg); border-color: var(--slate); }
.btn.primary { background: var(--green); color: #fff; border-color: var(--green); }
.other { position: relative; flex: 1 1 240px; min-width: 0; }
.other input { width: 100%; border: 1px solid var(--line-strong); border-radius: 6px; padding: 6px 10px; background: var(--card); }
.other .list { position: absolute; left: 0; right: 0; top: 100%; z-index: 4; background: var(--card); border: 1px solid var(--line-strong); border-radius: 6px; margin-top: 4px; max-height: 260px; overflow: auto; box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
.other .list button { display: block; width: 100%; text-align: left; border: 0; background: transparent; padding: 7px 10px; cursor: pointer; border-bottom: 1px solid var(--line); }
.other .list button:hover { background: var(--green-soft); }
.note-in { flex: 1 1 200px; min-width: 0; border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px; background: var(--card); }
.status { margin-top: 8px; font-size: 12px; color: var(--mid); }
.status.ok { color: var(--green-fg); }
.status.auto { color: var(--warn-fg); }
.more { justify-self: center; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
@media (max-width: 640px) {
  .card { grid-template-columns: 1fr; }
  .thumb { width: 150px; height: 200px; background-size: 750px 800px; background-position: calc(var(--tx) * -0.625) calc(var(--ty) * -0.625); }
  .bar { width: 100px; }
}
@media (prefers-reduced-motion: reduce) { .bar > i { transition: none; } }
</style>

<div class="top">
  <div class="top-in">
    <div><h1>Catalogue Matching</h1><div class="sub">China Cycle 2026 · PDFs collected at the show, not yet linked to an exhibitor</div></div>
    <div class="progress"><div class="bar"><i id="bar"></i></div><span id="prog">…</span></div>
  </div>
  <div class="tools">
    <button class="chip" data-f="todo" aria-pressed="true">To review <b id="n-todo"></b></button>
    <button class="chip" data-f="nocand" aria-pressed="false">No suggestion <b id="n-nocand"></b></button>
    <button class="chip" data-f="auto" aria-pressed="false">Auto-matched <b id="n-auto"></b></button>
    <button class="chip" data-f="done" aria-pressed="false">Decided <b id="n-done"></b></button>
    <button class="chip" data-f="all" aria-pressed="false">All <b id="n-all"></b></button>
    <input class="search" id="q" type="search" placeholder="Filter by file name, folder or brand…" autocomplete="off">
  </div>
</div>
<div class="banner" id="banner" hidden><div class="note" id="banner-text"></div></div>
<main id="list"></main>

<script>
const ITEMS = __ITEMS__;
const INDEX = __INDEX__;
const SHEETS = __SHEETS__;
const byId = new Map(INDEX.map(e => [e.id, e]));
let decisions = new Map();      // key → { decision, exhibitor_id, note, by, at }
let db = null, userApi = null, canWrite = true, names = new Map();
let filter = 'todo', query = '', shown = 40;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function stateOf(it) {
  const d = decisions.get(it.key);
  if (d && d.decision) return d.decision === 'link' ? 'done' : d.decision === 'skip' ? 'skipped' : 'unsure';
  if (it.auto) return 'auto';
  return it.candidates.length ? 'todo' : 'nocand';
}
function matches(it) {
  const st = stateOf(it);
  if (filter === 'todo' && !(st === 'todo' || st === 'nocand' || st === 'unsure')) return false;
  if (filter === 'nocand' && st !== 'nocand') return false;
  if (filter === 'auto' && st !== 'auto') return false;
  if (filter === 'done' && !(st === 'done' || st === 'skipped')) return false;
  if (query) {
    const h = (it.filename + ' ' + it.folder + ' ' + it.brand_guess + ' ' + it.ocr_names).toLowerCase();
    if (!h.includes(query)) return false;
  }
  return true;
}
function counts() {
  const c = { todo: 0, nocand: 0, auto: 0, done: 0, all: ITEMS.length };
  for (const it of ITEMS) { const st = stateOf(it); if (st === 'todo' || st === 'nocand' || st === 'unsure') c.todo++; if (st === 'nocand') c.nocand++; if (st === 'auto') c.auto++; if (st === 'done' || st === 'skipped') c.done++; }
  for (const k of Object.keys(c)) $('#n-' + k).textContent = c[k];
  const decided = c.done + c.auto;
  $('#prog').textContent = decided + ' / ' + ITEMS.length + ' linked or closed';
  $('#bar').style.width = Math.round(100 * decided / ITEMS.length) + '%';
}
function candHTML(c, selected) {
  return '<button type="button" class="cand" data-id="' + esc(c.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
    '<span class="dot"></span><span><span class="brand">' + esc(c.brand || '—') + '</span> <span class="en">' + esc(c.en) + '</span>' +
    (c.cn ? '<div class="cn">' + esc(c.cn) + '</div>' : '') + '</span>' +
    '<span class="where">' + esc(c.hall || '') + ' ' + esc(c.booth || '') + (c.score ? '<div class="score">match ' + c.score + '</div>' : '') + '</span></button>';
}
function cardHTML(it) {
  const d = decisions.get(it.key) || {};
  const st = stateOf(it);
  const chosenId = d.exhibitor_id || (it.auto ? it.auto.id : null);
  const cands = it.candidates.slice();
  if (chosenId && !cands.some(c => c.id === chosenId) && byId.has(chosenId)) cands.unshift({ ...byId.get(chosenId), score: 0 });
  const t = it.thumb;
  const thumb = t ? '<div class="thumb" style="background-image:url(sheets/sheet_' + String(t.sheet).padStart(2, '0') + '.jpg);--tx:' + t.x + 'px;--ty:' + t.y + 'px"></div>'
                  : '<div class="thumb none">No preview</div>';
  let status = '';
  if (st === 'done') status = '<div class="status ok">Linked to ' + esc((byId.get(d.exhibitor_id) || {}).en || d.exhibitor_id) + who(d) + '</div>';
  else if (st === 'skipped') status = '<div class="status">Closed: not an exhibitor / no match' + who(d) + '</div>';
  else if (st === 'unsure') status = '<div class="status auto">Marked unsure' + who(d) + '</div>';
  else if (st === 'auto') status = '<div class="status auto">Matched automatically (identical brand). Confirm or pick another.</div>';
  return '<article class="card ' + st + '" data-key="' + esc(it.key) + '">' +
    '<div class="thumb-wrap">' + thumb + '<div class="meta">' + esc(it.folder) + '</div></div>' +
    '<div>' +
      '<div class="file">' + esc(it.filename) + '</div>' +
      (it.brand_guess ? '<span class="guess">guess: ' + esc(it.brand_guess) + '</span>' : '') +
      (it.ocr_names ? '<div class="ocr">Names read in the PDF: <span>' + esc(it.ocr_names) + '</span></div>' : '') +
      '<div class="cands">' + (cands.length ? cands.map(c => candHTML(c, c.id === chosenId)).join('') : '<div class="meta">No exhibitor suggested. Search below.</div>') + '</div>' +
      '<div class="row">' +
        '<div class="other"><input type="search" placeholder="Search another exhibitor (brand, company, booth)…" autocomplete="off" data-other><div class="list" hidden></div></div>' +
        '<button type="button" class="btn" data-act="skip" aria-pressed="' + (st === 'skipped') + '">Not an exhibitor / skip</button>' +
        '<button type="button" class="btn" data-act="unsure" aria-pressed="' + (st === 'unsure') + '">Unsure</button>' +
      '</div>' +
      '<div class="row"><input class="note-in" type="text" placeholder="Note (optional)" value="' + esc(d.note || '') + '" data-note maxlength="300"></div>' +
      status +
    '</div></article>';
}
function who(d) {
  if (!d.by) return '';
  const n = names.get(d.by) || '';
  const when = d.at ? new Date(d.at).toLocaleDateString() : '';
  return ' · ' + esc(n || 'someone') + (when ? ' · ' + when : '');
}
function render() {
  counts();
  const list = ITEMS.filter(matches);
  const slice = list.slice(0, shown);
  $('#list').innerHTML = slice.map(cardHTML).join('') +
    (list.length > shown ? '<button type="button" class="btn more" id="more">Show ' + Math.min(40, list.length - shown) + ' more (' + (list.length - shown) + ' left)</button>' : '') +
    (list.length ? '' : '<div class="meta">Nothing in this view.</div>');
}
async function save(key, patch) {
  const prev = decisions.get(key) || {};
  const doc = { ...prev, ...patch, at: new Date().toISOString() };
  if (userApi) { try { doc.by = await userApi.id(); } catch {} }
  decisions.set(key, doc); render();
  if (!db) { showBanner('Decisions are kept on this screen only: the shared store is not available in this view.'); return; }
  try { await db.collection('decisions').doc(key).set(doc); }
  catch (e) {
    if (e && e.code === 'invalid_argument') { canWrite = false; showBanner('You can view this page but not save decisions. Ask the owner to share it with you as Contributor or Editor.'); }
    else showBanner('Could not save the last decision (' + (e && e.code || 'error') + '). Try again.');
  }
}
function showBanner(t) { $('#banner-text').textContent = t; $('#banner').hidden = false; }

document.addEventListener('click', ev => {
  const chip = ev.target.closest('.chip'); if (chip) { filter = chip.dataset.f; shown = 40; document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === chip)); render(); return; }
  if (ev.target.id === 'more') { shown += 40; render(); return; }
  const card = ev.target.closest('.card'); if (!card) return;
  const key = card.dataset.key;
  const cand = ev.target.closest('.cand');
  if (cand) { save(key, { decision: 'link', exhibitor_id: cand.dataset.id }); return; }
  const act = ev.target.closest('[data-act]');
  if (act) { const cur = (decisions.get(key) || {}).decision; save(key, { decision: cur === act.dataset.act ? '' : act.dataset.act, exhibitor_id: '' }); return; }
  const pick = ev.target.closest('.other .list button');
  if (pick) { save(key, { decision: 'link', exhibitor_id: pick.dataset.id }); return; }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'q') { query = ev.target.value.trim().toLowerCase(); shown = 40; render(); return; }
  if (ev.target.matches('[data-other]')) {
    const q = ev.target.value.trim().toLowerCase(); const box = ev.target.nextElementSibling;
    if (q.length < 2) { box.hidden = true; return; }
    const hits = INDEX.filter(e => (e.brand + ' ' + e.en + ' ' + e.cn + ' ' + e.booth).toLowerCase().includes(q)).slice(0, 8);
    box.innerHTML = hits.map(e => '<button type="button" data-id="' + esc(e.id) + '"><span class="brand">' + esc(e.brand || '—') + '</span> ' + esc(e.en) + (e.cn ? ' <span class="cn">' + esc(e.cn) + '</span>' : '') + ' <span class="where">' + esc(e.hall) + ' ' + esc(e.booth) + '</span></button>').join('') || '<div class="meta" style="padding:8px 10px">No exhibitor found</div>';
    box.hidden = false;
  }
});
document.addEventListener('change', ev => {
  if (ev.target.matches('[data-note]')) { const key = ev.target.closest('.card').dataset.key; save(key, { note: ev.target.value.trim() }); }
});
document.addEventListener('focusout', ev => { if (ev.target.matches('[data-other]')) setTimeout(() => { const b = ev.target.nextElementSibling; if (b) b.hidden = true; }, 200); });

render();
(async () => {
  db = await claude.use('db');
  userApi = await claude.use('user');
  if (!db) { showBanner('Shared store unavailable in this view: decisions will not be saved.'); return; }
  db.collection('decisions').onSnapshot(async snap => {
    decisions = new Map(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]));
    const ids = [...new Set([...decisions.values()].map(d => d.by).filter(Boolean))];
    if (userApi && ids.length) { try { const ps = await userApi.profiles(ids); for (const id of ids) names.set(id, (ps[id] && ps[id].name) || ''); } catch {} }
    render();
  }, e => showBanner('Live updates stopped (' + e.code + '). Reload the page.'));
})();
</script>
'''
html = HTML.replace('__ITEMS__', json.dumps(items, ensure_ascii=False, separators=(',', ':'))) \
           .replace('__INDEX__', json.dumps(index, ensure_ascii=False, separators=(',', ':'))) \
           .replace('__SHEETS__', json.dumps({k: v for k, v in sheets.items() if k != 'pos'}))
(ON / "index.html").write_text(html, encoding="utf-8")
print(f"index.html : {len(html)//1024} Ko · {len(items)} PDF · {len(index)} exposants · {len(sheets.get('pos', {}))} vignettes")
