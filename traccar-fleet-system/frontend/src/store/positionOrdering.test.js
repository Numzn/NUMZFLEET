import test from 'node:test';
import assert from 'node:assert/strict';

import { isOlderFix } from './positionOrdering.js';
import { sessionActions, sessionReducer } from './session.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const at = (iso, extra = {}) => ({
  id: 1, deviceId: 7, latitude: -15.4, longitude: 28.3, fixTime: iso, ...extra,
});

test('isOlderFix: only a strictly older fix is rejected', () => {
  const held = at('2026-10-15T11:59:00Z');
  assert.equal(isOlderFix(held, at('2026-10-15T11:58:00Z'), NOW), true);
  assert.equal(isOlderFix(held, at('2026-10-15T11:59:00Z'), NOW), false, 'equal fix is applied');
  assert.equal(isOlderFix(held, at('2026-10-15T11:59:30Z'), NOW), false);
});

test('isOlderFix: missing or unparsable times never block an update', () => {
  assert.equal(isOlderFix(undefined, at('2026-10-15T11:59:00Z'), NOW), false);
  assert.equal(isOlderFix(at('2026-10-15T11:59:00Z'), at(undefined), NOW), false);
  assert.equal(isOlderFix(at('garbage'), at('2026-10-15T11:59:00Z'), NOW), false);
});

test('isOlderFix: a held fix with a clock far in the future does not freeze the device', () => {
  const held = at('2027-10-15T12:00:00Z'); // a year ahead
  assert.equal(isOlderFix(held, at('2026-10-15T11:59:00Z'), NOW), false);
});

const initialState = () => ({
  server: { attributes: {} },
  user: { attributes: {} },
  socket: null,
  includeLogs: false,
  logs: [],
  positions: {},
  history: {},
});

test('updatePositions: a late, older frame does not replace the latest position', () => {
  let state = sessionReducer(initialState(), sessionActions.updatePositions([
    at('2026-10-15T11:59:00Z', { latitude: -15.5 }),
  ]));
  state = sessionReducer(state, sessionActions.updatePositions([
    at('2026-10-15T11:50:00Z', { latitude: -15.1 }),
  ]));

  assert.equal(state.positions[7].latitude, -15.5);
});

test('updatePositions: an in-order backlog replay ends on the newest fix', () => {
  const backlog = [0, 2, 4, 6].map((s) => at(`2026-10-15T11:50:0${s}Z`, { latitude: -15 - s / 100 }));
  const state = sessionReducer(initialState(), sessionActions.updatePositions(backlog));
  assert.equal(state.positions[7].latitude, -15.06);
});

test('updatePositions: other devices are independent', () => {
  let state = sessionReducer(initialState(), sessionActions.updatePositions([
    at('2026-10-15T11:59:00Z'),
  ]));
  state = sessionReducer(state, sessionActions.updatePositions([
    at('2026-10-15T11:00:00Z', { deviceId: 8, id: 2 }),
  ]));
  assert.ok(state.positions[8]);
});
