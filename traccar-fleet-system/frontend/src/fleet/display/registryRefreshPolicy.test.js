import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_REFRESH_INTERVAL_MS,
  TRIGGER_DEBOUNCE_MS,
  VISIBLE_STALE_MS,
  mileageFingerprint,
  nextRefreshDelay,
  shouldRefreshOnVisible,
} from './registryRefreshPolicy.js';

const pos = (deviceId, totalDistance, extra = {}) => ({ deviceId, attributes: { totalDistance, ...extra } });

test('the fingerprint is the same for the same counters regardless of key order', () => {
  const a = mileageFingerprint({ 2: pos(2, 5000), 1: pos(1, 12000) });
  const b = mileageFingerprint({ 1: pos(1, 12000), 2: pos(2, 5000) });
  assert.equal(a, b);
});

test('the fingerprint changes when a tracker counter advances by a tenth of a km', () => {
  const before = mileageFingerprint({ 1: pos(1, 12000) });
  assert.notEqual(before, mileageFingerprint({ 1: pos(1, 12100) }));
});

test('sub-100 m jitter and unrelated attributes do not change the fingerprint', () => {
  const before = mileageFingerprint({ 1: pos(1, 12010, { ignition: false }) });
  assert.equal(before, mileageFingerprint({ 1: pos(1, 12090, { ignition: true, batteryLevel: 50 }) }));
});

test('a position without counters contributes nothing, and no positions give an empty fingerprint', () => {
  assert.equal(mileageFingerprint({}), '');
  assert.equal(mileageFingerprint(null), '');
  assert.equal(mileageFingerprint({ 1: { deviceId: 1, attributes: {} } }), '');
  assert.equal(mileageFingerprint({ 1: { deviceId: 1 } }), '');
});

test('both counters a tracker may report are watched', () => {
  const a = mileageFingerprint({ 1: pos(1, null, { odometer: 5000 }) });
  assert.notEqual(a, '');
  assert.notEqual(a, mileageFingerprint({ 1: pos(1, null, { odometer: 5200 }) }));
});

test('a change is applied after the debounce when nothing was fetched recently', () => {
  assert.equal(nextRefreshDelay({ lastLoadedAt: 0, now: 10 * 60000 }), TRIGGER_DEBOUNCE_MS);
});

test('a change right after a fetch waits for the minimum interval, so a moving fleet cannot hammer the API', () => {
  const now = 1_000_000;
  assert.equal(nextRefreshDelay({ lastLoadedAt: now - 1000, now }), MIN_REFRESH_INTERVAL_MS - 1000);
  assert.equal(nextRefreshDelay({ lastLoadedAt: now - MIN_REFRESH_INTERVAL_MS, now }), TRIGGER_DEBOUNCE_MS);
});

test('the wait is never shorter than the debounce nor negative', () => {
  const now = 1_000_000;
  assert.ok(nextRefreshDelay({ lastLoadedAt: now - (MIN_REFRESH_INTERVAL_MS - 100), now }) >= TRIGGER_DEBOUNCE_MS);
  assert.ok(nextRefreshDelay({ lastLoadedAt: now + 5000, now }) >= TRIGGER_DEBOUNCE_MS);
});

test('returning to a hidden tab refreshes only when the data is old enough to matter', () => {
  const now = 1_000_000;
  assert.equal(shouldRefreshOnVisible({ lastLoadedAt: now - VISIBLE_STALE_MS - 1, now }), true);
  assert.equal(shouldRefreshOnVisible({ lastLoadedAt: now - 1000, now }), false);
  assert.equal(shouldRefreshOnVisible({ lastLoadedAt: 0, now }), true);
});
