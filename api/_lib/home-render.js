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

// Tri par défaut du client (nom anglais, ordre croissant, comparaison < / >).
export function defaultOrder(raw) {
  return raw.map((e, idx) => ({ e, idx })).sort((a, b) => {
    const av = (a.e.en || '').toLowerCase(), bv = (b.e.en || '').toLowerCase();
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
}

export function rowHTML(e, idx, rowNum, { HALL_COLORS, CAT_COLORS, CAT_DEFAULT }) {
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
      (hasCatalogue(e) ? '<div><span class="co-catalogue" title="Catalogue collected at the show">Catalogue</span></div>' : '') +
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
  };
  const rows = defaultOrder(raw).slice(0, PAGE_SIZE)
    .map(({ e, idx }, i) => rowHTML(e, idx, i + 1, consts)).join('');
  const catalogueCount = raw.filter(hasCatalogue).length;

  let html = template;
  html = replaceOnce(html, '<tbody id="tbody"></tbody>', `<tbody id="tbody">${rows}</tbody>`);
  html = replaceOnce(html, '<span class="stat-num" id="statCatalogues">0</span>',
    `<span class="stat-num" id="statCatalogues">${catalogueCount.toLocaleString('en-US')}</span>`);
  html = replaceOnce(html, '<div class="count-pill" id="countPill"><strong>1,633</strong> results</div>',
    `<div class="count-pill" id="countPill"><strong>${raw.length.toLocaleString('en-US')}</strong> results</div>`);
  return applySiteVars(html, { contactEmail, siteUrl });
}
