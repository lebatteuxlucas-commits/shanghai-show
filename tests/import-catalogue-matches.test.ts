// Tests de l'import catalogue_matches.csv. Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyMatches, locateRaw, mergeCatalogues, parseCsv, pyJson, readMatches } from '../scripts/import-catalogue-matches.ts';

test('CSV : BOM, CRLF, guillemets et virgules dans un nom de fichier', () => {
  const rows = parseCsv('﻿supplier_id,filename,category_folder\r\nofficial_0,"JAK, 2026 ""kids"".pdf",Kids\r\n\r\n');
  assert.deepEqual(rows, [['supplier_id', 'filename', 'category_folder'], ['official_0', 'JAK, 2026 "kids".pdf', 'Kids']]);
});

test('CSV : colonnes dans le désordre, lignes incomplètes ignorées, colonne manquante signalée', () => {
  const { bySupplier, skipped } = readMatches('Category_Folder,Filename,Supplier_ID\nKids,a.pdf,official_0\nKids,,official_1\n');
  assert.deepEqual(bySupplier.get('official_0'), [{ filename: 'a.pdf', category_folder: 'Kids' }]);
  assert.equal(skipped, 1);
  assert.throws(() => readMatches('supplier_id,filename\nx,y\n'), /category_folder/);
});

test('fusion sans doublon et ordre stable', () => {
  const a = { filename: 'a.pdf', category_folder: 'Kids' };
  const b = { filename: 'b.pdf', category_folder: 'E-bike' };
  assert.deepEqual(mergeCatalogues([a], [b, a, { ...a }]), [b, a]);
});

test('ré-exécution : même résultat, aucun doublon ; --replace retire ce qui a disparu', () => {
  const entries: any[] = [{ id: 'official_0' }, { id: 'official_1' }];
  const m = readMatches('supplier_id,filename,category_folder\nofficial_0,a.pdf,Kids\nofficial_0,a.pdf,Kids\nghost,x.pdf,Y\n').bySupplier;
  const first = applyMatches(entries, m, false);
  assert.equal(first.added, 1);
  assert.deepEqual(first.unknown, ['ghost']);
  assert.deepEqual(entries[1].catalogues, []);
  const snapshot = JSON.stringify(entries);
  assert.equal(applyMatches(entries, m, false).added, 0);
  assert.equal(JSON.stringify(entries), snapshot);
  applyMatches(entries, new Map(), true);
  assert.deepEqual(entries[0].catalogues, []);
});

test('sérialisation identique à celle du pipeline Python pour le RAW actuel', () => {
  const html = readFileSync(new URL('../china_cycle_suppliers.html', import.meta.url), 'utf8');
  const { open, close } = locateRaw(html);
  const original = html.slice(open, close + 1);
  const entries = JSON.parse(original).map((e: any) => { const { catalogues, ...rest } = e; return rest; });
  const rebuilt = '[' + entries.map(pyJson).join(',') + ']';
  const stripped = original.replace(/, "catalogues": \[[^\]]*\]/g, '');
  assert.equal(rebuilt, stripped);
});

test('un nom de fichier ne peut pas fermer la balise <script>', () => {
  assert.ok(!pyJson({ filename: '</script><img src=x>' }).includes('</script>'));
});
