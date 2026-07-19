import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeZambianPhone } from './phoneNumber.js';

test('normalizeZambianPhone accepts local 0-prefixed format', () => {
  assert.equal(normalizeZambianPhone('0977123456'), '+260977123456');
  assert.equal(normalizeZambianPhone('0966987654'), '+260966987654');
});

test('normalizeZambianPhone accepts already-E.164', () => {
  assert.equal(normalizeZambianPhone('+260977123456'), '+260977123456');
});

test('normalizeZambianPhone accepts 00-international prefix', () => {
  assert.equal(normalizeZambianPhone('00260977123456'), '+260977123456');
});

test('normalizeZambianPhone accepts bare 260-prefixed', () => {
  assert.equal(normalizeZambianPhone('260977123456'), '+260977123456');
});

test('normalizeZambianPhone accepts bare 9-digit national number', () => {
  assert.equal(normalizeZambianPhone('977123456'), '+260977123456');
});

test('normalizeZambianPhone strips spaces, dashes, parens', () => {
  assert.equal(normalizeZambianPhone('097 712-3456'), '+260977123456');
  assert.equal(normalizeZambianPhone('+260 (977) 123-456'), '+260977123456');
});

test('normalizeZambianPhone returns null for missing or invalid input', () => {
  assert.equal(normalizeZambianPhone(null), null);
  assert.equal(normalizeZambianPhone(undefined), null);
  assert.equal(normalizeZambianPhone(''), null);
  assert.equal(normalizeZambianPhone('not a phone'), null);
  assert.equal(normalizeZambianPhone('123'), null);
  assert.equal(normalizeZambianPhone('0977'), null);
  assert.equal(normalizeZambianPhone('+15551234567'), null); // non-Zambian E.164
});
