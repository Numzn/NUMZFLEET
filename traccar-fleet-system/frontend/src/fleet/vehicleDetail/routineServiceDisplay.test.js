import test from 'node:test';
import assert from 'node:assert/strict';

import { routineDueText } from './routineServiceDisplay.js';

test('the wording comes from the backend\'s own label, so the header and the panel can never differ', () => {
  assert.equal(routineDueText({ dueLabel: '250 km overdue', remainingKm: -250 }), '250 km overdue');
  assert.equal(routineDueText({ dueLabel: 'Due in 1,200 km', remainingKm: 1200 }), 'Due in 1,200 km');
  assert.equal(routineDueText({ dueLabel: 'Service due now', remainingKm: 0 }), 'Service due now');
});

test('the backend\'s label wins even when it says more than the number does', () => {
  assert.equal(routineDueText({ dueLabel: 'Awaiting telemetry', remainingKm: null }), 'Awaiting telemetry');
  assert.equal(routineDueText({ dueLabel: 'Due now (see workshop)', remainingKm: 5 }), 'Due now (see workshop)');
});

test('REGRESSION: an overdue service is never worded as "Due in -N km"', () => {
  assert.equal(routineDueText({ remainingKm: -250 }), '250 km overdue');
  assert.doesNotMatch(routineDueText({ remainingKm: -250 }), /-/);
});

test('without a label the wording is derived from the remaining km, in the same words', () => {
  assert.equal(routineDueText({ remainingKm: 1200 }), 'Due in 1,200 km');
  assert.equal(routineDueText({ remainingKm: 0 }), 'Service due now');
  assert.equal(routineDueText({ remainingKm: -0 }), 'Service due now');
  assert.equal(routineDueText({ remainingKm: 1 }), 'Due in 1 km');
});

test('no schedule, or nothing measurable, is a dash', () => {
  assert.equal(routineDueText(null), '—');
  assert.equal(routineDueText({}), '—');
  assert.equal(routineDueText({ remainingKm: null }), '—');
  assert.equal(routineDueText({ remainingKm: 'abc' }), '—');
});

test('an empty label falls through to the derived wording', () => {
  assert.equal(routineDueText({ dueLabel: '', remainingKm: -5 }), '5 km overdue');
});
