// Tests du back-office des demandes de catalogue. Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorized } from '../api/admin.js';

const basic = (user: string, pass: string) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

test('authentification : bon mot de passe accepté, quel que soit l’identifiant', () => {
  assert.equal(isAuthorized(basic('lucas', 's3cret'), 's3cret'), true);
  assert.equal(isAuthorized(basic('', 's3cret'), 's3cret'), true);
});

test('authentification : mot de passe faux ou en-tête absent refusés', () => {
  assert.equal(isAuthorized(basic('lucas', 'mauvais'), 's3cret'), false);
  assert.equal(isAuthorized(null, 's3cret'), false);
  assert.equal(isAuthorized('Bearer xyz', 's3cret'), false);
  assert.equal(isAuthorized('Basic !!!pas du base64!!!', 's3cret'), false);
});

test('authentification : sans ADMIN_PASSWORD, tout est refusé', () => {
  assert.equal(isAuthorized(basic('lucas', ''), ''), false);
  assert.equal(isAuthorized(basic('lucas', 'x'), undefined as any), false);
});

test('mot de passe contenant « : » (le séparateur ne coupe que le premier)', () => {
  assert.equal(isAuthorized(basic('lucas', 'a:b:c'), 'a:b:c'), true);
});
