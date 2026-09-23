// Applique data/review/review_decisions.csv (produit par la page de revue) à
// RAW, inliné dans china_cycle_suppliers.html.
//
//   decision = link  → le catalogue est ajouté à l'exposant existing_id
//   decision = add   → nouvel exposant « added_<marque> », présent au salon
//   decision = skip / undecided → rien
//
// Règle : aucune fiche « add » sans hall (on n'invente jamais un stand).
// Ré-exécutable : relancer ne crée ni doublon de fichier ni doublon de fiche.
//
// Usage : node scripts/apply-review-decisions.ts [data/review/review_decisions.csv]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { locateRaw } from '../api/_lib/raw-data.js';
import { replaceById } from '../api/_lib/home-render.js';
import { mergeCatalogues, parseCsv, pyJson, type CatalogueFile } from './import-catalogue-matches.ts';

type Entry = {
  id: string; en: string; cn: string; hall: string; hallEn: string; scope: string;
  cats: string[]; booth: string; halls: string[]; brand: string; brand_source?: string;
  website?: string; catalogues?: CatalogueFile[]; [key: string]: unknown;
};
type Decision = Record<string, string>;

const HTML_PATH = fileURLToPath(new URL('../china_cycle_suppliers.html', import.meta.url));
const DEFAULT_CSV = fileURLToPath(new URL('../data/review/review_decisions.csv', import.meta.url));

export function readDecisions(csvText: string): Decision[] {
  const [header, ...lines] = parseCsv(csvText);
  if (!header) return [];
  const cols = header.map(h => h.trim());
  return lines.map(r => Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? '').trim()])));
}

// « Shenzhen Ryder Electronics » → « shenzhen_ryder_electronics »
export function slug(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

// Table hall → libellé anglais, reprise des fiches existantes.
export function hallLabels(entries: Entry[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of entries) if (e.hall && e.hallEn && !m.has(e.hall)) m.set(e.hall, e.hallEn);
  return m;
}

export function applyDecisions(entries: Entry[], decisions: Decision[]) {
  const byId = new Map(entries.map(e => [e.id, e]));
  const labels = hallLabels(entries);
  const res = { linked: 0, added: 0, skipped: 0, errors: [] as string[] };

  for (const d of decisions) {
    const file: CatalogueFile = { filename: d.filename, category_folder: d.category_folder || '' };
    if (!d.filename) { res.errors.push('ligne sans filename'); continue; }

    if (d.decision === 'link') {
      const e = byId.get(d.existing_id);
      if (!e) { res.errors.push(`${d.filename} : exposant « ${d.existing_id} » absent de RAW`); continue; }
      const before = (e.catalogues || []).length;
      e.catalogues = mergeCatalogues(e.catalogues || [], [file]);
      if (e.catalogues.length > before) res.linked++;
      continue;
    }

    if (d.decision === 'add') {
      if (!d.new_hall) { res.errors.push(`${d.filename} : ajout refusé, hall manquant`); continue; }
      if (!labels.has(d.new_hall)) { res.errors.push(`${d.filename} : hall « ${d.new_hall} » inconnu`); continue; }
      if (!d.new_en && !d.new_brand) { res.errors.push(`${d.filename} : ajout refusé, ni nom anglais ni marque`); continue; }
      const base = 'added_' + (slug(d.new_brand) || slug(d.new_en));
      // Même marque, même société → on complète la fiche existante ; sinon on suffixe.
      let id = base, n = 2;
      while (byId.has(id) && (byId.get(id) as Entry).en !== (d.new_en || d.new_brand)) id = `${base}_${n++}`;
      const existing = byId.get(id) as Entry | undefined;
      if (existing) {
        const before = (existing.catalogues || []).length;
        existing.catalogues = mergeCatalogues(existing.catalogues || [], [file]);
        if (existing.catalogues.length > before) res.linked++;
        continue;
      }
      const entry: Entry = {
        id,
        en: d.new_en || d.new_brand,
        cn: d.new_cn || '',
        hall: d.new_hall,
        hallEn: labels.get(d.new_hall) || '',
        scope: '',
        cats: [],
        booth: d.new_booth || '',      // jamais inventé
        halls: [d.new_hall],
        brand: d.new_brand || '',
        brand_source: 'catalogue',
        catalogues: [file],
      };
      if (d.new_website) entry.website = d.new_website;
      entries.push(entry);
      byId.set(id, entry);
      res.added++;
      continue;
    }

    res.skipped++;   // skip, undecided, ou décision inconnue
  }
  return res;
}

// Compteurs affichés en tête de page (nombre d'exposants).
export function updateCounts(html: string, total: number): string {
  const pretty = total.toLocaleString('en-US');
  const set = (h: string, id: string, inner: string) => {
    try { return replaceById(h, id, inner); } catch { return h; }
  };
  let out = html.replace(
    /<span class="stat-num">[\d,]+<\/span><span class="stat-label">Suppliers<\/span>/,
    `<span class="stat-num">${pretty}</span><span class="stat-label">Suppliers</span>`);
  out = set(out, 'tc-suppliers', pretty);
  out = set(out, 'countPill', `<strong>${pretty}</strong> results`);
  return out;
}

function main(argv: string[]) {
  const csvPath = argv.find(a => !a.startsWith('--')) || DEFAULT_CSV;
  const decisions = readDecisions(readFileSync(csvPath, 'utf8'));
  const html = readFileSync(HTML_PATH, 'utf8');
  const { open, close } = locateRaw(html);
  const entries: Entry[] = JSON.parse(html.slice(open, close + 1));
  const totalBefore = entries.length;

  const res = applyDecisions(entries, decisions);
  let next = html.slice(0, open) + '[' + entries.map(pyJson).join(',') + ']' + html.slice(close + 1);
  next = updateCounts(next, entries.length);
  if (next !== html) writeFileSync(HTML_PATH, next);

  const withCat = entries.filter(e => (e.catalogues || []).length).length;
  console.log(`${decisions.length} décision(s) lue(s) · ${res.linked} catalogue(s) rattaché(s) · ${res.added} exposant(s) ajouté(s) · ${res.skipped} ignorée(s)`);
  if (res.errors.length) {
    console.error(`✖ ${res.errors.length} erreur(s) :`);
    for (const e of res.errors) console.error('    ' + e);
  }
  console.log(`Exposants : ${totalBefore} → ${entries.length} · avec catalogue : ${withCat}`);
  console.log(next === html ? '= china_cycle_suppliers.html inchangé' : '✓ china_cycle_suppliers.html mis à jour');
  if (res.errors.length) process.exit(1);
}

if (import.meta.main) main(process.argv.slice(2));
