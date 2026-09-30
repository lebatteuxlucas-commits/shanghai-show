// Rendu serveur de la page d'accueil : en-tête, compteurs et premières lignes
// du tableau sont écrits dans le HTML pour que Google et les aperçus de lien
// (LinkedIn…) voient du contenu. Le script client re-rend ensuite le tableau
// à l'identique : le gabarit de ligne ci-dessous est le miroir de render().
import vm from 'node:vm';
import { parseRaw } from './raw-data.js';

export const PAGE_SIZE = 50;   // = PAGE côté client
export const DEFAULT_SITE_URL = 'https://shanghai-show.vercel.app';

// Évalue un littéral `const NOM = {...};` du script de la page (HALL_COLORS,
// CAT_COLORS…) pour ne pas dupliquer ces tables côté serveur.
export function extractConst(html, name) {
  const start = html.indexOf(`const ${name} = `);
  if (start < 0) throw new Error(`${name} introuvable dans le HTML`);
  const open = html.indexOf('{', start);
  let depth = 0, quote = null;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return vm.runInNewContext('(' + html.slice(open, i + 1) + ')');
  }
  throw new Error(`${name} : accolades non appariées`);
}

// Mêmes fonctions que côté client (esc, normalizeUrl, catTagHTML, hasCatalogue).
export function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const normalizeUrl = (u) => (u && !/^https?:\/\//i.test(u)) ? 'https://' + u : (u || '');
const hasCatalogue = (e) => Array.isArray(e.catalogues) && e.catalogues.length > 0;

// Vue d'arrivée : la liste complète (aucun hall imposé). Conservé pour les
// appels existants ; renvoie toujours « tous les halls ».
export function defaultHall() {
  return '';
}

// Tri par défaut du client : exposants documentés d'abord (catalogue + site,
// catalogue, site, rien), puis hall et stand — l'ordre de visite sur le salon.
export function richTier(e) {
  const c = hasCatalogue(e), w = !!e.website;
  return c && w ? 0 : c ? 1 : w ? 2 : 3;
}
export function defaultOrder(raw) {
  return raw.map((e, idx) => ({ e, idx })).sort((a, b) => {
    const t = richTier(a.e) - richTier(b.e);
    if (t) return t;
    const ah = (a.e.hall || '').toLowerCase(), bh = (b.e.hall || '').toLowerCase();
    if (ah !== bh) return ah < bh ? -1 : 1;
    const ab = (a.e.booth || '').toLowerCase(), bb = (b.e.booth || '').toLowerCase();
    return ab < bb ? -1 : ab > bb ? 1 : 0;
  });
}

// Couvertures : même clé que le client (coverKey) et que scripts/covers/make_covers.py.
function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
export function coverKey(f) { const a = f.category_folder + '/' + f.filename, b = f.filename + '/' + f.category_folder; return fnv1a(a).toString(16).padStart(8, '0') + fnv1a(b).toString(16).padStart(8, '0'); }
function firstCover(e, COVERS) { for (const f of (e.catalogues || [])) { const k = coverKey(f); if (COVERS && COVERS[k]) return 'assets/covers/' + k + '.jpg'; } return ''; }
function catRowHTML(e, idx, COVERS) {
  const cov = firstCover(e, COVERS), n = (e.catalogues || []).length;
  return '<div class="cat-row">' + (cov ? '<img class="cover-sm" loading="lazy" decoding="async" src="' + esc(cov) + '" alt="" onerror="this.remove()">' : '') +
    '<div><button type="button" class="co-catalogue co-catalogue-btn" title="Request this catalogue" onclick="event.stopPropagation();openCatalogueRequest(' + idx + ')">Catalogue · Request</button>' +
    (n > 1 ? '<div class="cover-more">' + n + ' files</div>' : '') + '</div></div>';
}

export function rowHTML(e, idx, rowNum, { HALL_COLORS, CAT_COLORS, CAT_DEFAULT, COVERS = {} }) {
  const catTagHTML = (c) => {
    const cc = CAT_COLORS[c] || CAT_DEFAULT;
    return `<span class="cat-tag" style="background:${cc.bg};color:${cc.fg};border-color:${cc.bg}">${esc(c)}</span>`;
  };
  const hallList = (e.halls && e.halls.length) ? e.halls : (e.hall ? [e.hall] : []);
  const hallPills = hallList.length
    ? hallList.map(h => {
        const hc = HALL_COLORS[h] || { bg: '#f0f0f0', c: '#9e9e9e' };
        return '<span class="hall-pill" style="background:' + hc.bg + ';color:' + hc.c + '">' + esc(h) + '</span>';
      }).join(' ')
    : '<span class="hall-pill" style="background:#f0f0f0;color:#9e9e9e">—</span>';
  const cats = e.cats.length ? e.cats.map(catTagHTML).join('') : '<span class="no-val">—</span>';
  const scope = e.scope ? '<div class="scope-text">' + esc(e.scope) + '</div>' : '<span class="no-val">—</span>';
  const siteLink = e.website
    ? '<div class="co-site"><a href="' + esc(normalizeUrl(e.website)) + '" target="_blank" rel="noopener">🔗 ' +
      esc(e.website.replace(/^https?:\/\//, '').split('/')[0]) + '</a></div>'
    : '';
  const boothCell = e.booth ? '<code class="booth-code">' + esc(e.booth) + '</code>' : '<span class="no-val">—</span>';
  const brandLine = e.brand ? '<div class="co-brand">' + esc(e.brand) + '</div>' : '';
  return '<tr onclick="openPanel(' + idx + ')" style="cursor:pointer">' +
    '<td class="row-num">' + rowNum + '</td>' +
    '<td>' + brandLine +
      '<div class="co-en">' + esc(e.en || '—') + '</div>' +
      (e.cn ? '<div class="co-cn">' + esc(e.cn) + '</div>' : '') +
      (hasCatalogue(e) ? catRowHTML(e, idx, COVERS) : '') +
      siteLink + '</td>' +
    '<td>' + hallPills +
      '<div class="hall-sub">' + esc(e.hallEn || 'Unassigned') + '</div></td>' +
    '<td>' + boothCell + '</td>' +
    '<td><div class="cat-tags">' + cats + '</div></td>' +
    '<td>' + scope + '</td>' +
    '</tr>';
}

// Remplace une portion attendue du HTML ; échoue bruyamment si le gabarit a
// changé, plutôt que de servir une page silencieusement incomplète.
function replaceOnce(html, search, replacement) {
  const i = html.indexOf(search);
  if (i < 0) throw new Error(`Rendu serveur : repère introuvable « ${search.slice(0, 60)} »`);
  return html.slice(0, i) + replacement + html.slice(i + search.length);
}

// Remplace le contenu d'un élément repéré par son id, quel que soit son
// contenu actuel : les compteurs changent quand des exposants sont ajoutés.
// La balise fermante est cherchée par son nom (le contenu peut lui-même
// contenir des balises, ex. « <strong>1,633</strong> results »).
export function replaceById(html, id, inner) {
  const at = html.indexOf(`id="${id}"`);
  if (at < 0) throw new Error(`Élément « ${id} » introuvable`);
  const tagStart = html.lastIndexOf('<', at);
  const tag = (html.slice(tagStart + 1).match(/^[a-zA-Z0-9-]+/) || [])[0];
  const open = html.indexOf('>', at);
  if (!tag || open < 0) throw new Error(`Élément « ${id} » mal formé`);
  let i = open + 1, depth = 1;
  while (i < html.length) {
    const nextOpen = html.indexOf('<' + tag, i);
    const nextClose = html.indexOf('</' + tag, i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) { depth++; i = nextOpen + 1; continue; }
    if (--depth === 0) return html.slice(0, open + 1) + inner + html.slice(nextClose);
    i = nextClose + 1;
  }
  throw new Error(`Élément « ${id} » : balise fermante introuvable`);
}

// Remplacements communs à toutes les pages : email de contact et URL du site.
export function applySiteVars(html, { contactEmail, siteUrl }) {
  let out = html;
  if (siteUrl && siteUrl !== DEFAULT_SITE_URL) out = out.split(DEFAULT_SITE_URL).join(siteUrl);
  if (contactEmail) {
    const e = esc(contactEmail);
    out = replaceOnce(out, '<meta name="fm-contact" content="">', `<meta name="fm-contact" content="${e}">`);
    out = out.split('<a class="site-footer-contact" hidden href="">').join(`<a class="site-footer-contact" href="mailto:${e}">${e}`);
  }
  return out;
}

export function renderHome(template, { contactEmail, siteUrl } = {}) {
  const raw = parseRaw(template);
  const consts = {
    HALL_COLORS: extractConst(template, 'HALL_COLORS'),
    CAT_COLORS: extractConst(template, 'CAT_COLORS'),
    CAT_DEFAULT: extractConst(template, 'CAT_DEFAULT'),
    COVERS: extractConst(template, 'COVERS'),
  };
  const visible = defaultOrder(raw);
  const rows = visible.slice(0, PAGE_SIZE)
    .map(({ e, idx }, i) => rowHTML(e, idx, i + 1, consts)).join('');
  const catalogueCount = raw.filter(hasCatalogue).length;
  const hallCount = new Set(raw.map(e => e.hall).filter(Boolean)).size;

  let html = template;
  html = replaceOnce(html, '<tbody id="tbody"></tbody>', `<tbody id="tbody">${rows}</tbody>`);
  // Compteurs d'en-tête : la base complète, jamais la vue filtrée.
  html = replaceById(html, 'statSuppliers', raw.length.toLocaleString('en-US'));
  html = replaceById(html, 'statHalls', hallCount.toLocaleString('en-US'));
  html = replaceById(html, 'statWebsites', raw.filter(e => e.website).length.toLocaleString('en-US'));
  html = replaceById(html, 'statProducts', raw.filter(e => e.scope).length.toLocaleString('en-US'));
  html = replaceById(html, 'statCatalogues', catalogueCount.toLocaleString('en-US'));
  html = replaceById(html, 'tc-dashboard', `${catalogueCount}/${raw.length}`);
  // Comme le client après son premier rendu : la liste complète.
  html = replaceById(html, 'tc-suppliers', visible.length.toLocaleString('en-US'));
  html = replaceById(html, 'countPill',
    `<strong>${visible.length.toLocaleString('en-US')}</strong> result${visible.length !== 1 ? 's' : ''}`);
  return applySiteVars(html, { contactEmail, siteUrl });
}
