// Tests du rendu serveur (accueil + privacy) sur les vrais fichiers. Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applySiteVars, defaultHall, defaultOrder, extractConst, renderHome, replaceById, PAGE_SIZE } from '../api/_lib/home-render.js';
import { parseRaw } from '../api/_lib/raw-data.js';

const home = readFileSync(new URL('../china_cycle_suppliers.html', import.meta.url), 'utf8');
const privacy = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');

test('accueil : vue d’arrivée (hall le mieux doté), lignes et compteurs écrits dans le HTML', () => {
  const raw = parseRaw(home);
  const hall = defaultHall(raw);
  const html = renderHome(home, { contactEmail: 'contact@futuremotion.example' });
  const tbody = html.slice(html.indexOf('<tbody id="tbody">'), html.indexOf('</tbody>'));
  const visible = defaultOrder(raw).filter(({ e }) => e.hall === hall);
  assert.equal((tbody.match(/<tr /g) || []).length, Math.min(PAGE_SIZE, visible.length));
  assert.ok(tbody.includes(visible[0].e.en.replace(/&/g, '&amp;')), 'première ligne = premier exposant du hall, par ordre alphabétique');
  // Le compteur reflète la vue affichée, comme après le premier rendu du client.
  assert.ok(html.includes(`id="countPill"><strong>${visible.length.toLocaleString('en-US')}</strong> results`));
  assert.ok(html.includes(`id="tc-suppliers">${visible.length.toLocaleString('en-US')}<`));
  assert.match(html, /id="statCatalogues">\d/);
});

test('hall d’arrivée : celui qui a le plus de catalogues (hall principal)', () => {
  assert.equal(defaultHall([
    { id: 'a', hall: 'E1', catalogues: [] },
    { id: 'b', hall: 'W4', catalogues: [{ filename: 'x', category_folder: '' }] },
    { id: 'c', hall: 'W4', catalogues: [] },
  ] as any), 'W4');
  // Aucune donnée de catalogue : pas de hall imposé, on reste sur « All Halls ».
  assert.equal(defaultHall([{ id: 'a', hall: 'E1', catalogues: [] }] as any), '');
});

test('email de contact injecté dans la meta et le pied de page', () => {
  const html = renderHome(home, { contactEmail: 'contact@futuremotion.example' });
  assert.ok(html.includes('<meta name="fm-contact" content="contact@futuremotion.example">'));
  assert.ok(html.includes('<a class="site-footer-contact" href="mailto:contact@futuremotion.example">contact@futuremotion.example</a>'));
  assert.ok(!html.includes('site-footer-contact" hidden'));
});

test('sans CONTACT_EMAIL : liens de contact laissés masqués', () => {
  const html = renderHome(home, {});
  assert.ok(html.includes('<meta name="fm-contact" content="">'));
  assert.ok(html.includes('<a class="site-footer-contact" hidden href=""></a>'));
});

test('SITE_URL remplace le domaine par défaut dans les balises OpenGraph', () => {
  const html = renderHome(home, { siteUrl: 'https://directory.futuremotion.example' });
  assert.ok(html.includes('<meta property="og:image" content="https://directory.futuremotion.example/assets/og-image.png">'));
  assert.ok(!html.includes('shanghai-show.vercel.app'));
});

test('métadonnées de partage présentes', () => {
  for (const tag of ['<title>China Cycle 2026 Supplier Directory — FutureMotion</title>', 'name="description"',
    'property="og:title"', 'property="og:image"', 'content="1200"', 'content="630"', 'name="twitter:card" content="summary_large_image"',
    'rel="icon"']) {
    assert.ok(home.includes(tag), tag);
  }
});

test('privacy : email injecté dans le texte et le pied de page', () => {
  const html = applySiteVars(privacy, { contactEmail: 'contact@futuremotion.example' });
  assert.equal(html.split('href="mailto:contact@futuremotion.example"').length - 1, 2);
});

test('constantes lues dans le script de la page', () => {
  assert.equal(extractConst(home, 'HALL_COLORS').E1.label, 'Bicycles');
  assert.ok(extractConst(home, 'CAT_COLORS')['Complete Bikes'].bg);
});

test('email échappé (pas d’injection HTML via CONTACT_EMAIL)', () => {
  const html = renderHome(home, { contactEmail: 'a"><script>x</script>@b.co' });
  assert.ok(!html.includes('"><script>x</script>'));
});

test('replaceById gère les balises imbriquées et reste stable', () => {
  const h = '<div class="count-pill" id="countPill"><strong>1,633</strong> results</div>';
  const once = replaceById(h, 'countPill', '<strong>1,700</strong> results');
  assert.equal(once, '<div class="count-pill" id="countPill"><strong>1,700</strong> results</div>');
  assert.equal(replaceById(once, 'countPill', '<strong>1,700</strong> results'), once);
});
