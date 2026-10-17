import test from 'node:test';
import assert from 'node:assert/strict';

import { odometerFieldValue, prefillFromOdometer } from './completionFormState.js';

test('the prefill is the system odometer rounded to a whole km, or empty when there is none', () => {
  assert.equal(prefillFromOdometer(125510.4), '125510');
  assert.equal(prefillFromOdometer(125510.6), '125511');
  assert.equal(prefillFromOdometer(0), '0');
  assert.equal(prefillFromOdometer(null), '');
  assert.equal(prefillFromOdometer(undefined), '');
  assert.equal(prefillFromOdometer('abc'), '');
});

test('an untouched odometer field follows the live odometer as it moves', () => {
  assert.equal(odometerFieldValue({ current: '125510', touched: false, live: 125530 }), '125530');
});

test('what the person typed is never overwritten by a live update', () => {
  assert.equal(odometerFieldValue({ current: '125000', touched: true, live: 125530 }), '125000');
});

test('a live update that carries no odometer does not blank an untouched field', () => {
  assert.equal(odometerFieldValue({ current: '125510', touched: false, live: null }), '125510');
});

test('an unticked, untouched field with no live value stays empty', () => {
  assert.equal(odometerFieldValue({ current: '', touched: false, live: undefined }), '');
});
