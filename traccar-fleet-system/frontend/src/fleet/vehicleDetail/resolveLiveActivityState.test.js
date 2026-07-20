import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveLiveActivityState } from './resolveLiveActivityState.js';

const NOW = new Date('2026-07-09T17:00:00Z').getTime();

test('resolveLiveActivityState: online + positive speed is moving', () => {
  assert.equal(resolveLiveActivityState({
    deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 23, now: NOW,
  }), 'moving');
});

test('resolveLiveActivityState: online + zero/no speed is idle', () => {
  assert.equal(resolveLiveActivityState({
    deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0, now: NOW,
  }), 'idle');
  assert.equal(resolveLiveActivityState({
    deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: null, now: NOW,
  }), 'idle');
});

test('resolveLiveActivityState: offline status with stale lastUpdate is offline regardless of speed', () => {
  assert.equal(resolveLiveActivityState({
    deviceStatus: 'offline', deviceLastUpdate: NOW - 10 * 60_000, positionSpeed: 40, now: NOW,
  }), 'offline');
});

test('resolveLiveActivityState: offline status but lastUpdate within freshness window is treated online', () => {
  // Matches backend resolveActivityState.js precedence exactly: online if
  // EITHER the status says so OR the last heartbeat is recent — a device
  // that just flipped to "offline" in Traccar's own bookkeeping but pinged
  // seconds ago is still current, not stale.
  assert.equal(resolveLiveActivityState({
    deviceStatus: 'offline', deviceLastUpdate: NOW - 60_000, positionSpeed: 0, now: NOW,
  }), 'idle');
});

test('resolveLiveActivityState: non-online status (e.g. "unknown") falls back to lastUpdate freshness', () => {
  assert.equal(resolveLiveActivityState({
    deviceStatus: 'unknown', deviceLastUpdate: NOW - 60_000, positionSpeed: 0, now: NOW,
  }), 'idle', 'recent lastUpdate (<5min) keeps it online-equivalent');
  assert.equal(resolveLiveActivityState({
    deviceStatus: 'unknown', deviceLastUpdate: NOW - 10 * 60_000, positionSpeed: 0, now: NOW,
  }), 'offline', 'stale lastUpdate (>5min) is offline');
});

test('resolveLiveActivityState: missing deviceLastUpdate and non-online status is offline', () => {
  assert.equal(resolveLiveActivityState({
    deviceStatus: null, deviceLastUpdate: null, positionSpeed: 10, now: NOW,
  }), 'offline');
});
