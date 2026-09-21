// Importe catalogue_matches.csv dans les données fournisseurs (RAW inliné dans
// china_cycle_suppliers.html) : champ `catalogues` = [{ filename, category_folder }],
// liste vide pour les fournisseurs sans catalogue.
//
// Usage (Node ≥ 22.18, qui exécute le TypeScript sans dépendance) :
//   node scripts/import-catalogue-matches.ts catalogue_matches.csv
//       fusionne le CSV avec les catalogues déjà importés (sans doublon)
//   node scripts/import-catalogue-matches.ts catalogue_matches.csv --replace
//       le CSV devient la liste complète : ce qui n'y figure plus est retiré
//
// Ré-exécutable : relancer avec le même CSV ne change pas le fichier.
// À relancer après rebuild_db.py, qui régénère RAW sans ce champ.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type CatalogueFile = { filename: string; category_folder: string };
type Entry = { id: string; catalogues?: CatalogueFile[]; [key: string]: unknown };

const HTML_PATH = fileURLToPath(new URL('../china_cycle_suppliers.html', import.meta.url));

// ── CSV (RFC 4180 : guillemets, virgules et sauts de ligne dans les champs, BOM) ──
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
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

// Regroupe les lignes par fournisseur ; lève une erreur si une colonne manque.
export function readMatches(csvText: string): { bySupplier: Map<string, CatalogueFile[]>; skipped: number } {
  const [header, ...lines] = parseCsv(csvText);
  if (!header) throw new Error('CSV vide');
  const cols = header.map(h => h.trim().toLowerCase());
  const idx = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new Error(`Colonne « ${name} » absente (trouvé : ${cols.join(', ')})`);
    return i;
  };
  const iId = idx('supplier_id'), iFile = idx('filename'), iFolder = idx('category_folder');
  const bySupplier = new Map<string, CatalogueFile[]>();
  let skipped = 0;
  for (const r of lines) {
    const id = (r[iId] || '').trim();
    const filename = (r[iFile] || '').trim();
    const category_folder = (r[iFolder] || '').trim();
    if (!id || !filename) { skipped++; continue; }
    const list = bySupplier.get(id) || [];
    list.push({ filename, category_folder });
    bySupplier.set(id, list);
  }
  return { bySupplier, skipped };
}

// Union sans doublon (clé = dossier + fichier), triée pour un résultat stable.
export function mergeCatalogues(existing: CatalogueFile[], incoming: CatalogueFile[]): CatalogueFile[] {
  const seen = new Map<string, CatalogueFile>();
  for (const f of [...existing, ...incoming]) {
    const key = f.category_folder + '\u0000' + f.filename;
    if (!seen.has(key)) seen.set(key, { filename: f.filename, category_folder: f.category_folder });
  }
  return [...seen.values()].sort((a, b) =>
    a.category_folder.localeCompare(b.category_folder) || a.filename.localeCompare(b.filename));
}

// Même format que json.dumps(..., ensure_ascii=False) des scripts Python du
// pipeline (séparateurs ", " et ": "), pour ne pas réécrire tout RAW à chaque
// import. « < » est échappé en < : un nom de fichier contenant
// « </script> » ne peut pas casser la page (RAW n'en contient aucun par ailleurs).
export function pyJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v).replace(/</g, '\\u003c');
  if (Array.isArray(v)) return '[' + v.map(pyJson).join(', ') + ']';
  return '{' + Object.entries(v).map(([k, x]) => pyJson(k) + ': ' + pyJson(x)).join(', ') + '}';
}

// Parcours du tableau RAW partagé avec la route serveur.
import { locateRaw } from '../api/_lib/raw-data.js';
export { locateRaw };

export function applyMatches(entries: Entry[], bySupplier: Map<string, CatalogueFile[]>, replace: boolean) {
  const known = new Set(entries.map(e => e.id));
  let added = 0;
  for (const e of entries) {
    const before = replace ? [] : (Array.isArray(e.catalogues) ? e.catalogues : []);
    const next = mergeCatalogues(before, bySupplier.get(e.id) || []);
    if (!replace) added += next.length - before.length;
    e.catalogues = next;
  }
  const unknown = [...bySupplier.keys()].filter(id => !known.has(id));
  return { added, unknown };
}

function main(argv: string[]) {
  const csvPath = argv.find(a => !a.startsWith('--'));
  const replace = argv.includes('--replace');
  if (!csvPath) {
    console.error('Usage : node scripts/import-catalogue-matches.ts <catalogue_matches.csv> [--replace]');
    process.exit(1);
  }
  const { bySupplier, skipped } = readMatches(readFileSync(csvPath, 'utf8'));
  const html = readFileSync(HTML_PATH, 'utf8');
  const { open, close } = locateRaw(html);
  const entries: Entry[] = JSON.parse(html.slice(open, close + 1));

  const { added, unknown } = applyMatches(entries, bySupplier, replace);
  const next = html.slice(0, open) + '[' + entries.map(pyJson).join(',') + ']' + html.slice(close + 1);
  if (next !== html) writeFileSync(HTML_PATH, next);

  const withCat = entries.filter(e => e.catalogues!.length).length;
  const files = entries.reduce((n, e) => n + e.catalogues!.length, 0);
  if (skipped) console.warn(`⚠ ${skipped} ligne(s) sans supplier_id ou filename ignorée(s)`);
  if (unknown.length) {
    console.warn(`⚠ ${unknown.length} supplier_id inconnu(s), ignoré(s) : ${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? '…' : ''}`);
  }
  console.log(`${replace ? 'Remplacement' : `Fusion : ${added} fichier(s) ajouté(s)`} · ${withCat} fournisseur(s) avec catalogue · ${files} fichier(s)`);
  console.log(next === html ? '= china_cycle_suppliers.html inchangé' : '✓ china_cycle_suppliers.html mis à jour');
}

if (import.meta.main) main(process.argv.slice(2));
