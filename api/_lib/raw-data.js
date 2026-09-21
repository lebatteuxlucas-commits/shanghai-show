// Accès aux données fournisseurs (RAW inliné dans china_cycle_suppliers.html).
// Partagé entre la route serveur et scripts/import-catalogue-matches.ts :
// le HTML déployé reste l'unique source de vérité.
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Localise le tableau RAW dans le HTML (même parcours que rebuild_db.py).
export function locateRaw(html) {
  const start = html.indexOf('const RAW = [');
  if (start < 0) throw new Error('const RAW = [ introuvable');
  const open = html.indexOf('[', start);
  let depth = 0, inStr = false, esc = false;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === '"') inStr = !inStr;
    else if (!inStr) {
      if (c === '[') depth++;
      else if (c === ']' && --depth === 0) return { open, close: i };
    }
  }
  throw new Error('Crochets de RAW non appariés');
}

export function parseRaw(html) {
  const { open, close } = locateRaw(html);
  return JSON.parse(html.slice(open, close + 1));
}

// Index id → fournisseur, construit une fois par instance. Sur Vercel, le HTML
// est embarqué dans la fonction via `includeFiles` (vercel.json).
let _byId = null;
export function suppliersById(htmlPath = path.join(process.cwd(), 'china_cycle_suppliers.html')) {
  if (!_byId) _byId = new Map(parseRaw(readFileSync(htmlPath, 'utf8')).map(e => [e.id, e]));
  return _byId;
}

export function supplierLabel(e) {
  if (!e) return '';
  if (e.brand && e.en) return `${e.brand} (${e.en})`;
  return e.brand || e.en || e.cn || e.id;
}
