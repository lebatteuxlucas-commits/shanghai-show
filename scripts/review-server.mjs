// Page de revue LOCALE des catalogues sans correspondance.
// Jamais déployée : scripts/ et data/ sont exclus par .vercelignore, et le
// serveur refuse de démarrer sans REVIEW_MODE=1.
//
// Usage :
//   npm run review                      (REVIEW_MODE=1 node scripts/review-server.mjs)
//   CATALOGUES_DIR=/chemin npm run review   pour pointer un autre dossier de PDF
//
// Écrit au fil de l'eau data/review/review_decisions.csv ; aucune modification
// de RAW à cette étape (voir scripts/apply-review-decisions.ts).
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRaw } from '../api/_lib/raw-data.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REVIEW_DIR = path.join(ROOT, 'data/review');
const DECISIONS = path.join(REVIEW_DIR, 'review_decisions.csv');
const CATALOGUES_DIR = process.env.CATALOGUES_DIR
  || path.join(process.env.HOME, 'Library/Mobile Documents/com~apple~CloudDocs/TIS 2023 - 2025/FutureMotion');
const PORT = Number(process.env.PORT || 4180);

if (process.env.REVIEW_MODE !== '1') {
  console.error('Outil local : lancer avec REVIEW_MODE=1 (npm run review). Rien à déployer.');
  process.exit(1);
}

export const DECISION_COLUMNS = ['filename', 'category_folder', 'decision', 'existing_id', 'new_en', 'new_cn',
  'new_brand', 'new_hall', 'new_booth', 'new_website', 'note', 'decided_by', 'decided_at'];

// ── CSV ────────────────────────────────────────────────────────────────────
export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

function readCsvObjects(file) {
  if (!existsSync(file)) return [];
  const [header, ...lines] = parseCsv(readFileSync(file, 'utf8'));
  if (!header) return [];
  const cols = header.map(h => h.trim());
  return lines.map(r => Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? '').trim()])));
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function writeDecisions(list) {
  const lines = [DECISION_COLUMNS.join(',')];
  for (const d of list) lines.push(DECISION_COLUMNS.map(c => csvCell(d[c])).join(','));
  writeFileSync(DECISIONS, '﻿' + lines.join('\n') + '\n', 'utf8');
}

// ── Données de la revue ────────────────────────────────────────────────────
function loadItems() {
  const pass2 = readCsvObjects(path.join(REVIEW_DIR, 'catalogue_matches_pass2.csv'));
  const enrichis = readCsvObjects(path.join(REVIEW_DIR, '_non_rapproches_enrichis.csv'));
  const byFile = new Map(enrichis.map(e => [e.fichier, e]));
  // Restent à trancher : les lignes « aucun » et celles « à valider » laissées vides.
  return pass2
    .filter(r => !r.id_retenu && (r.statut === 'aucun' || r.statut === 'à valider'))
    .map(r => {
      const e = byFile.get(r.fichier) || {};
      return {
        filename: r.fichier,
        category_folder: r.dossier,
        cle: r.cle || e.supplier_guess || '',
        statut: r.statut,
        pdf_names: e.noms_trouves_dans_pdf || '',
        pdf_sites: e.sites || '',
        candidates: [1, 2, 3]
          .map(n => ({ id: r['id_' + n], label: r['cand_' + n] }))
          .filter(c => c.id),
      };
    });
}

function loadSuppliers() {
  const html = readFileSync(path.join(ROOT, 'china_cycle_suppliers.html'), 'utf8');
  return parseRaw(html).map(e => ({
    id: e.id, en: e.en || '', cn: e.cn || '', brand: e.brand || '',
    hall: e.hall || '', booth: e.booth || '', files: (e.catalogues || []).length,
  }));
}

function halls(suppliers) {
  const html = readFileSync(path.join(ROOT, 'china_cycle_suppliers.html'), 'utf8');
  const map = new Map();
  for (const e of parseRaw(html)) if (e.hall && !map.has(e.hall)) map.set(e.hall, e.hallEn || '');
  return [...map.entries()].sort().map(([code, en]) => ({ code, en }));
}

// ── Serveur ────────────────────────────────────────────────────────────────
const json = (res, data, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/review') {
    const html = readFileSync(path.join(ROOT, 'scripts/review/index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (url.pathname === '/api/data') {
    const suppliers = loadSuppliers();
    return json(res, { items: loadItems(), suppliers, halls: halls(suppliers), decisions: readCsvObjects(DECISIONS) });
  }

  if (url.pathname === '/api/decision' && req.method === 'POST') {
    const chunks = []; for await (const c of req) chunks.push(c);
    let d;
    try { d = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, { error: 'json' }, 400); }
    if (!d.filename || !d.decision) return json(res, { error: 'champs manquants' }, 400);
    // Un ajout d'exposant sans hall est refusé : on n'invente pas un stand.
    if (d.decision === 'add' && (!d.new_hall || !d.new_en || !d.new_brand)) {
      return json(res, { error: 'hall, nom anglais et marque obligatoires pour un ajout' }, 400);
    }
    const list = readCsvObjects(DECISIONS).filter(x => !(x.filename === d.filename && x.category_folder === d.category_folder));
    if (d.decision !== 'undecided') {
      list.push({ ...Object.fromEntries(DECISION_COLUMNS.map(c => [c, d[c] ?? ''])), decided_at: new Date().toISOString() });
    }
    writeDecisions(list);
    return json(res, { ok: true, decided: list.length });
  }

  // Aperçu / ouverture du PDF depuis CATALOGUES_DIR (chemin confiné à ce dossier).
  if (url.pathname === '/api/file') {
    const rel = url.searchParams.get('f') || '';
    const full = path.resolve(CATALOGUES_DIR, rel);
    if (!full.startsWith(path.resolve(CATALOGUES_DIR)) || !existsSync(full)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Fichier introuvable : ' + rel);
    }
    const type = full.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    return createReadStream(full).pipe(res);
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`Revue locale : http://localhost:${PORT}/review`);
  console.log(`PDF lus dans : ${CATALOGUES_DIR}`);
  console.log(`Décisions    : ${DECISIONS}`);
});
