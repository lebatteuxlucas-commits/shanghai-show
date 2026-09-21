// Tests de la demande de catalogue (sans réseau ni base). Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONSENT_TEXT, composeAcknowledgement, composeInternalEmail, isFreeEmail, parseRequest, sanitizeSession,
} from '../api/_lib/catalogue-request.js';
import { hashIp } from '../api/_lib/db.js';

const freeEmailConfig = JSON.parse(readFileSync(new URL('../config/free-email-domains.json', import.meta.url), 'utf8'));
const byId = new Map<string, any>([
  ['official_0', { id: 'official_0', brand: 'JAK', en: 'LANXI JIEKE SPORTS', cn: '兰溪市捷克', hall: 'E1', halls: ['E1'], booth: 'E1-0001',
                   catalogues: [{ filename: 'JAK kids 2026.pdf', category_folder: 'Kids bikes' }] }],
  ['official_1', { id: 'official_1', en: 'NO CATALOGUE CO.', hall: 'W2', halls: ['W2'], booth: 'W2-0009', catalogues: [] }],
  ['official_2', { id: 'official_2', brand: 'SINOPNE', en: 'REBORN BICYCLE', hall: 'E1', halls: ['E1'], booth: 'E1-0009', catalogues: [] }],
]);
const ctx = { byId, freeEmailConfig };
const valid = {
  supplierId: 'official_0', email: ' Anna@Acme-Bikes.eu ', company: 'Acme Bikes', name: '', message: 'Kids bikes,\n2k units',
  consent: true, website: '',
  session: { categories: ['Complete Bikes', 'Complete Bikes', 'Accessories'], suppliers: ['official_2', 'ghost', 'official_0'] },
};

test('demande valide : données résolues côté serveur (fournisseur, hall, fichiers)', () => {
  const { data } = parseRequest(valid, ctx) as any;
  assert.equal(data.email, 'anna@acme-bikes.eu');
  assert.equal(data.name, null);
  assert.equal(data.supplierName, 'JAK (LANXI JIEKE SPORTS)');
  assert.equal(data.hall, 'E1');
  assert.deepEqual(data.files, [{ filename: 'JAK kids 2026.pdf', category_folder: 'Kids bikes' }]);
});

test('champs obligatoires, consentement et fournisseur sans catalogue', () => {
  const r = parseRequest({ ...valid, email: 'nope', company: ' ', consent: 'yes', supplierId: 'official_1' }, ctx) as any;
  assert.equal(r.error, 'invalid_fields');
  assert.deepEqual(r.fields.sort(), ['company', 'consent', 'email', 'supplierId']);
});

test('emails grand public refusés (liste du fichier de config)', () => {
  for (const e of ['a@gmail.com', 'a@hotmail.com', 'a@outlook.com', 'a@yahoo.fr', 'a@icloud.com', 'a@qq.com', 'a@163.com', 'a@hotmail.co.uk']) {
    assert.equal((parseRequest({ ...valid, email: e }, ctx) as any).error, 'free_email', e);
  }
  assert.equal(isFreeEmail('buyer@decathlon.com', freeEmailConfig), false);
});

test('pot de miel : succès simulé, rien n’est traité', () => {
  assert.deepEqual(parseRequest({ ...valid, website: 'https://spam' }, ctx), { spam: true });
});

test('contexte de session : ids inconnus écartés, noms résolus côté serveur, doublons retirés', () => {
  const s = sanitizeSession(valid.session, byId);
  assert.deepEqual(s.categories, ['Complete Bikes', 'Accessories']);
  assert.deepEqual(s.suppliers, [{ id: 'official_2', name: 'SINOPNE (REBORN BICYCLE)' }, { id: 'official_0', name: 'JAK (LANXI JIEKE SPORTS)' }]);
  assert.deepEqual(sanitizeSession('garbage', byId), { categories: [], suppliers: [] });
});

test('email interne : objet au format demandé, fichiers, contexte et date', () => {
  const { data } = parseRequest(valid, ctx) as any;
  const { subject, text } = composeInternalEmail(data, new Date('2026-09-22T08:30:00Z'));
  assert.equal(subject, '[Catalogue request] JAK (LANXI JIEKE SPORTS) — Hall E1 / E1-0001');
  assert.match(text, /Kids bikes\/JAK kids 2026\.pdf/);
  assert.match(text, /2026-09-22 08:30 UTC/);
  assert.match(text, /Categories filtered: Complete Bikes, Accessories/);
  assert.match(text, /SINOPNE \(REBORN BICYCLE\) \[official_2\]/);
  assert.match(text, /Company: Acme Bikes/);
  assert.ok(text.includes(CONSENT_TEXT));
});

test('accusé de réception : texte exact, sans donnée saisie par l’utilisateur', () => {
  const { data } = parseRequest({ ...valid, message: 'BUY CHEAP PILLS http://spam' }, ctx) as any;
  const { text } = composeAcknowledgement(data);
  assert.equal(text, "Thanks — we've received your request for the JAK (LANXI JIEKE SPORTS) catalogue. It will be sent by email within one business day.\n\n— FutureMotion");
});

test('pas de retour chariot dans les champs sur une ligne', () => {
  const { data } = parseRequest({ ...valid, company: 'Acme\r\nBcc: x@evil.com' }, ctx) as any;
  assert.ok(!/[\r\n]/.test(data.company));
});

test('IP hachée, jamais stockée en clair', () => {
  assert.match(hashIp('203.0.113.7')!, /^[0-9a-f]{32}$/);
  assert.notEqual(hashIp('203.0.113.7'), hashIp('203.0.113.8'));
  assert.equal(hashIp(null), null);
});
