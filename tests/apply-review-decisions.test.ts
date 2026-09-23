// Tests de l'application des décisions de revue. Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDecisions, hallLabels, readDecisions, slug, updateCounts } from '../scripts/apply-review-decisions.ts';

const base = () => ([
  { id: 'official_0', en: 'LANXI JIEKE', cn: '兰溪', hall: 'E1', hallEn: 'Bicycles', scope: '', cats: [], booth: 'E1-0001', halls: ['E1'], brand: 'JAK', catalogues: [] },
  { id: 'official_1', en: 'REBORN', cn: '深圳', hall: 'W4', hallEn: 'Cycling & outdoor', scope: '', cats: [], booth: 'W4-0001', halls: ['W4'], brand: 'SINOPNE', catalogues: [] },
] as any[]);

const dec = (o: Record<string, string>) => ({ filename: 'x.pdf', category_folder: 'All Catalogues 220926', decision: 'skip',
  existing_id: '', new_en: '', new_cn: '', new_brand: '', new_hall: '', new_booth: '', new_website: '', note: '', decided_by: '', decided_at: '', ...o });

test('lecture du CSV de décisions', () => {
  const rows = readDecisions('filename,category_folder,decision,existing_id\n"a.pdf","All Catalogues 220926","link","official_0"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].existing_id, 'official_0');
});

test('link : le catalogue est ajouté à l’exposant existant, sans doublon', () => {
  const e = base();
  const d = [dec({ filename: 'a.pdf', decision: 'link', existing_id: 'official_0' })];
  assert.equal(applyDecisions(e, d).linked, 1);
  assert.deepEqual(e[0].catalogues, [{ filename: 'a.pdf', category_folder: 'All Catalogues 220926' }]);
  const again = applyDecisions(e, d);               // ré-exécution
  assert.equal(again.linked, 0);
  assert.equal(e[0].catalogues.length, 1);
});

test('link : exposant inconnu → erreur, rien n’est ajouté', () => {
  const e = base();
  const res = applyDecisions(e, [dec({ decision: 'link', existing_id: 'official_999' })]);
  assert.equal(res.linked, 0);
  assert.match(res.errors[0], /absent de RAW/);
});

test('add : nouvelle fiche complète, id added_<marque>', () => {
  const e = base();
  const res = applyDecisions(e, [dec({ filename: 'b.pdf', decision: 'add', new_en: 'SHENZHEN RYDER ELECTRONICS', new_brand: 'RYDBATT', new_hall: 'E5', new_booth: 'E5-0101', new_website: 'ryder.com' })]);
  // E5 n'existe pas dans le jeu d'essai : hall inconnu refusé
  assert.equal(res.added, 0);
  assert.match(res.errors[0], /hall « E5 » inconnu/);

  const res2 = applyDecisions(e, [dec({ filename: 'b.pdf', decision: 'add', new_en: 'SHENZHEN RYDER ELECTRONICS', new_brand: 'RYDBATT', new_hall: 'W4', new_booth: 'W4-9999' })]);
  assert.equal(res2.added, 1);
  const added = e.find(x => x.id === 'added_rydbatt');
  assert.equal(added.hallEn, 'Cycling & outdoor');   // libellé repris des fiches existantes
  assert.deepEqual(added.halls, ['W4']);
  assert.equal(added.brand_source, 'catalogue');
  assert.deepEqual(added.cats, []);
  assert.equal(added.catalogues.length, 1);
});

test('add : sans hall, refusé (on n’invente pas un stand)', () => {
  const e = base();
  const res = applyDecisions(e, [dec({ decision: 'add', new_en: 'X', new_brand: 'X' })]);
  assert.equal(res.added, 0);
  assert.match(res.errors[0], /hall manquant/);
});

test('add : ré-exécution sans doublon de fiche, marque homonyme suffixée', () => {
  const e = base();
  const d = [dec({ filename: 'b.pdf', decision: 'add', new_en: 'SOCIETE A', new_brand: 'DUP', new_hall: 'W4' })];
  applyDecisions(e, d);
  applyDecisions(e, d);
  assert.equal(e.filter(x => x.id.startsWith('added_dup')).length, 1);
  applyDecisions(e, [dec({ filename: 'c.pdf', decision: 'add', new_en: 'SOCIETE B', new_brand: 'DUP', new_hall: 'W4' })]);
  assert.deepEqual(e.filter(x => x.id.startsWith('added_dup')).map(x => x.id), ['added_dup', 'added_dup_2']);
});

test('skip et undecided n’écrivent rien', () => {
  const e = base();
  const res = applyDecisions(e, [dec({ decision: 'skip' }), dec({ decision: 'undecided' })]);
  assert.equal(res.skipped, 2);
  assert.equal(e.length, 2);
});

test('slug et table des halls', () => {
  assert.equal(slug('Shenzhen Ryder Electronics!'), 'shenzhen_ryder_electronics');
  assert.equal(hallLabels(base()).get('E1'), 'Bicycles');
});

test('compteurs d’exposants mis à jour dans le HTML', () => {
  const html = '<span class="stat-num">1,633</span><span class="stat-label">Suppliers</span>'
    + '<span class="tab-count" id="tc-suppliers">1633</span>'
    + '<div class="count-pill" id="countPill"><strong>1,633</strong> results</div>';
  const out = updateCounts(html, 1640);
  assert.equal(out,
    '<span class="stat-num">1,640</span><span class="stat-label">Suppliers</span>'
    + '<span class="tab-count" id="tc-suppliers">1,640</span>'
    + '<div class="count-pill" id="countPill"><strong>1,640</strong> results</div>');
  // Ré-application : le résultat ne doit pas se dégrader (bug des balises imbriquées).
  assert.equal(updateCounts(out, 1640), out);
});
