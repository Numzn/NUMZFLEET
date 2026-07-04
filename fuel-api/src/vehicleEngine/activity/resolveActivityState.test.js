import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveActivityState } from './resolveActivityState.js';

test('resolveActivityState: online status + positive speed -> moving', () => {
  assert.equal(resolveActivityState({ deviceStatus: 'online', deviceLastUpdate: new Date(), positionSpeed: 12 }), 'moving');
});

test('resolveActivityState: online status + zero speed -> idle', () => {
  assert.equal(resolveActivityState({ deviceStatus: 'online', deviceLastUpdate: new Date(), positionSpeed: 0 }), 'idle');
});

test('resolveActivityState: online status + no speed reading -> idle, not moving', () => {
  assert.equal(resolveActivityState({ deviceStatus: 'online', deviceLastUpdate: new Date(), positionSpeed: null }), 'idle');
});

test('resolveActivityState: explicit offline status + stale lastUpdate -> offline regardless of speed', () => {
  // Matches the original telemetryHub semantics faithfully: status==='online' is a
  // definitive yes, but status!=='online' is NOT a definitive no by itself — it
  // falls through to the freshness check, same as before this refactor.
  const stale = new Date(Date.now() - 6 * 60_000);
  assert.equal(resolveActivityState({ deviceStatus: 'offline', deviceLastUpdate: stale, positionSpeed: 40 }), 'offline');
});

test('resolveActivityState: status says offline but lastUpdate is still fresh -> freshness fallback wins (unchanged legacy behavior)', () => {
  const fresh = new Date();
  assert.equal(resolveActivityState({ deviceStatus: 'offline', deviceLastUpdate: fresh, positionSpeed: 40 }), 'moving');
});

test('resolveActivityState: status unknown but lastUpdate fresh (<5min) -> online (matches telemetryHub fallback)', () => {
  const fresh = new Date(Date.now() - 60_000);
  assert.equal(resolveActivityState({ deviceStatus: 'unknown', deviceLastUpdate: fresh, positionSpeed: 0 }), 'idle');
});

test('resolveActivityState: status unknown and lastUpdate stale (>5min) -> offline', () => {
  const stale = new Date(Date.now() - 6 * 60_000);
  assert.equal(resolveActivityState({ deviceStatus: 'unknown', deviceLastUpdate: stale, positionSpeed: 40 }), 'offline');
});

test('resolveActivityState: no device evidence at all -> offline, not fabricated as moving/idle', () => {
  assert.equal(resolveActivityState({ deviceStatus: null, deviceLastUpdate: null, positionSpeed: null }), 'offline');
});

test('resolveActivityState: real dev vehicle (deviceId 4) is correctly offline', () => {
  // Live values from tc_devices for deviceId 4, captured during the audit —
  // status='offline', lastupdate nearly a month stale.
  assert.equal(resolveActivityState({
    deviceStatus: 'offline',
    deviceLastUpdate: '2026-06-06T23:28:15.000Z',
    positionSpeed: 0,
    now: new Date('2026-07-04T00:00:00.000Z').getTime(),
  }), 'offline');
});
