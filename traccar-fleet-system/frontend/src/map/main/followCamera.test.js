import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeSafeArea,
  createFixFilter,
  haversineMeters,
  isValidFollowFix,
} from './followCamera.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const fix = (latitude, longitude, secondsAgo = 0, extra = {}) => ({
  id: 1,
  deviceId: 7,
  latitude,
  longitude,
  fixTime: new Date(NOW - secondsAgo * 1000).toISOString(),
  valid: true,
  ...extra,
});

test('haversineMeters: one degree of latitude is ~111 km', () => {
  const d = haversineMeters(0, 0, 1, 0);
  assert.ok(d > 111_000 && d < 111_400, `got ${d}`);
  assert.equal(haversineMeters(-15.4, 28.3, -15.4, 28.3), 0);
});

test('isValidFollowFix: accepts a normal fix', () => {
  assert.equal(isValidFollowFix(fix(-15.4167, 28.2833)), true);
});

test('isValidFollowFix: rejects missing, non-numeric, non-finite and out-of-range coordinates', () => {
  assert.equal(isValidFollowFix(null), false);
  assert.equal(isValidFollowFix(undefined), false);
  assert.equal(isValidFollowFix({ latitude: '1', longitude: '2' }), false);
  assert.equal(isValidFollowFix(fix(NaN, 28)), false);
  assert.equal(isValidFollowFix(fix(-15, Infinity)), false);
  assert.equal(isValidFollowFix(fix(91, 28)), false);
  assert.equal(isValidFollowFix(fix(-15, 181)), false);
});

test('isValidFollowFix: rejects null island and fixes the tracker marked invalid', () => {
  assert.equal(isValidFollowFix(fix(0, 0)), false);
  assert.equal(isValidFollowFix(fix(-15.4, 28.3, 0, { valid: false })), false);
  // A genuine position on the equator or prime meridian is still fine.
  assert.equal(isValidFollowFix(fix(0, 28.3)), true);
});

test('createFixFilter: follows ordinary movement', () => {
  const filter = createFixFilter();
  assert.equal(filter.evaluate(fix(-15.4000, 28.3000, 10), NOW).action, 'accept');
  assert.equal(filter.evaluate(fix(-15.4003, 28.3004, 5), NOW).action, 'accept');
});

test('createFixFilter: holds a teleporting outlier and drops it when the vehicle is back', () => {
  const filter = createFixFilter();
  filter.evaluate(fix(-15.4000, 28.3000, 10), NOW);

  // ~140 km away two seconds later: physically impossible.
  const spike = filter.evaluate(fix(-14.2000, 28.3000, 8), NOW);
  assert.equal(spike.action, 'hold');

  const back = filter.evaluate(fix(-15.4002, 28.3001, 6), NOW);
  assert.equal(back.action, 'accept');
  assert.equal(back.jump, false);
});

test('createFixFilter: a relocation confirmed by a second nearby fix is accepted as a jump', () => {
  const filter = createFixFilter();
  filter.evaluate(fix(-15.4000, 28.3000, 10), NOW);

  assert.equal(filter.evaluate(fix(-12.0000, 25.0000, 8), NOW).action, 'hold');
  const confirmed = filter.evaluate(fix(-12.0001, 25.0001, 6), NOW);
  assert.equal(confirmed.action, 'accept');
  assert.equal(confirmed.jump, true);
});

test('createFixFilter: a long reporting gap with plausible speed is not a spike', () => {
  const filter = createFixFilter();
  filter.evaluate(fix(-15.4000, 28.3000, 3600), NOW);
  // ~30 km after an hour of silence is ~8 m/s.
  const result = filter.evaluate(fix(-15.1300, 28.3000, 0), NOW);
  assert.equal(result.action, 'accept');
});

test('createFixFilter: ignores a fix older than the one already followed', () => {
  const filter = createFixFilter();
  filter.evaluate(fix(-15.4000, 28.3000, 5), NOW);
  const stale = filter.evaluate(fix(-15.4100, 28.3100, 60), NOW);
  assert.equal(stale.action, 'ignore');
});

test('createFixFilter: a device clock in the far future does not block newer fixes forever', () => {
  const filter = createFixFilter();
  filter.evaluate(fix(-15.4000, 28.3000, -86_400 * 365), NOW); // fix time one year ahead
  const next = filter.evaluate(fix(-15.4001, 28.3001, 0), NOW);
  assert.equal(next.action, 'accept');
});

test('createFixFilter: reset forgets the previous vehicle', () => {
  const filter = createFixFilter();
  filter.evaluate(fix(-15.4000, 28.3000, 5), NOW);
  filter.reset();
  // Would be a >1 km jump from the previous vehicle, but there is no history now.
  assert.equal(filter.evaluate(fix(-10.0, 20.0, 0), NOW).action, 'accept');
});

test('computeSafeArea: sidebar padding, right-hand controls and a margin shrink the area', () => {
  const safe = computeSafeArea({
    width: 1200,
    height: 800,
    padding: { left: 320, top: 56, right: 0, bottom: 0 },
    controls: [{ left: 1140, right: 1190, top: 64, bottom: 160 }],
    margin: 24,
    gap: 12,
  });

  assert.equal(safe.left, 344);
  assert.equal(safe.right, 1128);
  assert.equal(safe.top, 80);
  assert.equal(safe.bottom, 776);
  assert.equal(safe.center.x, (344 + 1128) / 2);
});

test('computeSafeArea: offset is the safe centre relative to the padded viewport centre', () => {
  const safe = computeSafeArea({
    width: 1000,
    height: 600,
    padding: { left: 200, top: 0, right: 0, bottom: 0 },
    controls: [{ left: 940, right: 990, top: 10, bottom: 100 }],
    margin: 20,
    gap: 10,
  });

  // padded centre x = 200 + (1000-200)/2 = 600; safe is [220, 930] => centre 575
  assert.equal(safe.offset.x, 575 - 600);
  assert.equal(safe.offset.y, 0);
});

test('computeSafeArea: extra bottom inset lifts the target', () => {
  const plain = computeSafeArea({ width: 800, height: 600, margin: 0 });
  const lifted = computeSafeArea({ width: 800, height: 600, margin: 0, extra: { bottom: 200 } });
  assert.equal(lifted.center.y, plain.center.y - 100);
});

test('computeSafeArea: falls back to the padded viewport when the area collapses', () => {
  const safe = computeSafeArea({
    width: 360,
    height: 640,
    padding: { left: 0, top: 56, right: 0, bottom: 600 },
    margin: 24,
  });
  assert.equal(safe.top, 56);
  assert.equal(safe.bottom, 40);
  assert.ok(Number.isFinite(safe.center.x) && Number.isFinite(safe.center.y));
});
