import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GLIDE_HEADROOM,
  MAX_GLIDE_MS,
  MIN_GLIDE_MS,
  MIN_HEADING_SPEED_KN,
  STALE_AFTER_MS,
  createMotionTracker,
} from './markerMotion.js';
import { haversineMeters } from '../main/followCamera.js';

const T0 = 1_000_000; // arbitrary monotonic clock origin (ms)
const EPOCH = Date.parse('2026-10-16T09:00:00Z');

/** 0.0001 degrees of latitude is about 11.1 m. */
const fix = (id, lat, lng, fixSeconds, extra = {}) => ({
  id,
  deviceId: 7,
  latitude: lat,
  longitude: lng,
  fixTime: new Date(EPOCH + fixSeconds * 1000).toISOString(),
  valid: true,
  ...extra,
});

const metres = (a, b) => haversineMeters(a[1], a[0], b[1], b[0]);

/** Two fixes, `gapMs` apart, 20 m apart: the tracker is now gliding. */
const gliding = (gapMs = 2000) => {
  const tracker = createMotionTracker();
  tracker.push(7, fix(1, -15.4000, 28.3000, 0), T0);
  tracker.push(7, fix(2, -15.4002, 28.3000, gapMs / 1000), T0 + gapMs);
  return tracker;
};

test('the first fix is drawn where it is: nothing to glide from', () => {
  const tracker = createMotionTracker();
  tracker.push(7, fix(1, -15.4, 28.3, 0), T0);

  assert.deepEqual(tracker.positionAt(7, T0), [28.3, -15.4]);
  assert.equal(tracker.isAnimating(T0), false);
});

test('an unknown device has no position', () => {
  const tracker = createMotionTracker();
  assert.equal(tracker.positionAt(99, T0), null);
  assert.equal(tracker.targetOf(99), null);
});

test('a new fix glides from the drawn position to the target and stops exactly on it', () => {
  const tracker = gliding(2000);
  const start = T0 + 2000;
  const duration = 2000 * GLIDE_HEADROOM;

  assert.deepEqual(tracker.positionAt(7, start), [28.3, -15.4], 'starts where the icon was drawn');
  assert.equal(tracker.isAnimating(start + 1), true);
  assert.deepEqual(tracker.positionAt(7, start + duration), [28.3, -15.4002]);
  assert.equal(tracker.isAnimating(start + duration), false);
  assert.deepEqual(tracker.positionAt(7, start + duration + 5000), [28.3, -15.4002], 'and stays there');
});

test('motion is continuous at constant speed: equal steps in equal time, no ease-out', () => {
  const tracker = gliding(2000);
  const start = T0 + 2000;
  const duration = 2000 * GLIDE_HEADROOM;

  const at = (fraction) => tracker.positionAt(7, start + duration * fraction);
  const quarter = metres(at(0), at(0.25));
  const second = metres(at(0.25), at(0.5));
  const third = metres(at(0.5), at(0.75));
  const last = metres(at(0.75), at(1));

  [second, third, last].forEach((step) => {
    assert.ok(Math.abs(step - quarter) < 0.01, `step ${step} should equal ${quarter}`);
  });
});

test('steady updates never stop-and-go: the icon is always moving between fixes', () => {
  const tracker = createMotionTracker();
  const cadence = 3000;
  for (let i = 0; i < 6; i += 1) {
    tracker.push(7, fix(i + 1, -15.4 - i * 0.0003, 28.3, i * 3), T0 + i * cadence);
  }
  // Sample the whole interval before the next fix would arrive.
  const lastPush = T0 + 5 * cadence;
  for (let offset = 1; offset < cadence; offset += 100) {
    assert.equal(tracker.isAnimating(lastPush + offset), true, `still moving ${offset} ms after a fix`);
  }
});

test('a fix arriving mid-glide re-targets without any jump', () => {
  const tracker = gliding(2000);
  const start = T0 + 2000;
  const midway = start + 1000;

  const before = tracker.positionAt(7, midway);
  tracker.push(7, fix(3, -15.4006, 28.3002, 3), midway);
  const after = tracker.positionAt(7, midway);

  assert.ok(metres(before, after) < 1e-6, `icon moved ${metres(before, after)} m at the hand-over`);
  assert.deepEqual(tracker.targetOf(7), [28.3002, -15.4006]);
});

test('glide length follows the observed update interval (with a little headroom)', () => {
  const slow = gliding(5000);
  assert.equal(slow.isAnimating(T0 + 5000 + 5000), true);
  assert.equal(slow.isAnimating(T0 + 5000 + 5000 * GLIDE_HEADROOM), false);
});

test('a burst of backlog fixes glides quickly, never slower than necessary', () => {
  const tracker = createMotionTracker();
  tracker.push(7, fix(1, -15.4000, 28.3, 0), T0);
  // Five 11 m hops delivered 20 ms apart (a tracker flushing its buffer).
  for (let i = 1; i <= 5; i += 1) {
    tracker.push(7, fix(i + 1, -15.4000 - i * 0.0001, 28.3, i * 2), T0 + i * 20);
  }
  const lastPush = T0 + 100;
  assert.equal(tracker.isAnimating(lastPush + MIN_GLIDE_MS - 1), true);
  assert.equal(tracker.isAnimating(lastPush + MIN_GLIDE_MS), false, 'settles within the minimum glide');
});

test('a very sparse tracker is capped so the icon does not trail by a whole interval', () => {
  const tracker = createMotionTracker();
  tracker.push(7, fix(1, -15.4000, 28.3, 0), T0);
  tracker.push(7, fix(2, -15.4020, 28.3, 60), T0 + 60_000);
  assert.equal(tracker.isAnimating(T0 + 60_000 + MAX_GLIDE_MS - 1), true);
  assert.equal(tracker.isAnimating(T0 + 60_000 + MAX_GLIDE_MS), false);
});

test('an impossible jump is shown instantly, never as a slide across the map', () => {
  const tracker = createMotionTracker();
  tracker.push(7, fix(1, -15.4, 28.3, 0), T0);
  // ~140 km in 2 s of fix time.
  tracker.push(7, fix(2, -14.2, 28.3, 2), T0 + 2000);

  assert.deepEqual(tracker.positionAt(7, T0 + 2000), [28.3, -14.2]);
  assert.equal(tracker.isAnimating(T0 + 2000), false);
});

test('a backlog is not mistaken for a teleport: plausibility uses fix time, not arrival time', () => {
  const tracker = createMotionTracker();
  tracker.push(7, fix(1, -15.4000, 28.3, 0), T0);
  // 111 m in 10 s of fix time (~40 km/h) but delivered 5 ms after the previous fix.
  tracker.push(7, fix(2, -15.4010, 28.3, 10), T0 + 5);
  assert.equal(tracker.isAnimating(T0 + 6), true);
});

test('a long silence resets: the next fix is drawn at once', () => {
  const tracker = createMotionTracker();
  tracker.push(7, fix(1, -15.4000, 28.3, 0), T0);
  tracker.push(7, fix(2, -15.4005, 28.3, 3600), T0 + STALE_AFTER_MS + 1);

  assert.deepEqual(tracker.positionAt(7, T0 + STALE_AFTER_MS + 1), [28.3, -15.4005]);
  assert.equal(tracker.isAnimating(T0 + STALE_AFTER_MS + 1), false);
});

test('sub-metre GPS jitter is shown as it is, not animated', () => {
  const tracker = createMotionTracker();
  tracker.push(7, fix(1, -15.400000, 28.300000, 0), T0);
  tracker.push(7, fix(2, -15.400003, 28.300001, 2), T0 + 2000); // ~0.35 m
  assert.equal(tracker.isAnimating(T0 + 2001), false);
});

test('a fix the tracker flags invalid is drawn instantly', () => {
  const tracker = createMotionTracker();
  tracker.push(7, fix(1, -15.4000, 28.3, 0), T0);
  tracker.push(7, fix(2, -15.4002, 28.3, 2, { valid: false }), T0 + 2000);
  assert.equal(tracker.isAnimating(T0 + 2001), false);
});

test('pushing the same position again (a re-render) does not restart the glide', () => {
  const tracker = gliding(2000);
  const start = T0 + 2000;
  const here = tracker.positionAt(7, start + 1000);

  tracker.push(7, fix(2, -15.4002, 28.3000, 2), start + 1000);

  assert.deepEqual(tracker.positionAt(7, start + 1000), here);
});

test('when disabled (reduced motion or the preference) every fix is drawn at once', () => {
  const tracker = createMotionTracker({ enabled: false });
  tracker.push(7, fix(1, -15.4000, 28.3, 0), T0);
  tracker.push(7, fix(2, -15.4002, 28.3, 2), T0 + 2000);

  assert.deepEqual(tracker.positionAt(7, T0 + 2000), [28.3, -15.4002]);
  assert.equal(tracker.isAnimating(T0 + 2001), false);
});

test('turning the tracker off mid-glide jumps to the target and reports nothing animating', () => {
  const tracker = gliding(2000);
  tracker.setEnabled(false);
  assert.deepEqual(tracker.positionAt(7, T0 + 2500), [28.3, -15.4002]);
  assert.equal(tracker.isAnimating(T0 + 2500), false);
});

test('devices are independent and pruned when no longer displayed', () => {
  const tracker = createMotionTracker();
  tracker.push(1, fix(1, -15.4, 28.3, 0, { deviceId: 1 }), T0);
  tracker.push(2, fix(2, -15.5, 28.4, 0, { deviceId: 2 }), T0);

  tracker.prune([1]);

  assert.notEqual(tracker.positionAt(1, T0), null);
  assert.equal(tracker.positionAt(2, T0), null);
});


// ------------------------------------------------------------------- heading
// A top-down car icon rotates with the vehicle, so the heading must turn
// smoothly through corners and never snap to north when the vehicle stops.

const moving = (id, lat, lng, fixSeconds, course, speed = 20) => fix(id, lat, lng, fixSeconds, { course, speed });

test('heading: the first fix points the icon the way the tracker says', () => {
  const tracker = createMotionTracker();
  tracker.push(7, moving(1, -15.4, 28.3, 0, 90), T0);
  assert.equal(tracker.headingAt(7, T0), 90);
  assert.equal(tracker.headingAt(99, T0), null);
});

test('heading: turns smoothly from the heading drawn now to the new course, at the glide pace', () => {
  const tracker = createMotionTracker();
  tracker.push(7, moving(1, -15.4000, 28.3, 0, 0), T0);
  tracker.push(7, moving(2, -15.4002, 28.3, 2, 90), T0 + 2000);

  const start = T0 + 2000;
  const duration = 2000 * GLIDE_HEADROOM;
  assert.equal(tracker.headingAt(7, start), 0);
  assert.ok(Math.abs(tracker.headingAt(7, start + duration / 2) - 45) < 1e-9, 'halfway through the turn');
  assert.equal(tracker.headingAt(7, start + duration), 90);
});

test('heading: turns the short way round (350 to 10 passes through north, not the long way)', () => {
  const tracker = createMotionTracker();
  tracker.push(7, moving(1, -15.4000, 28.3, 0, 350), T0);
  tracker.push(7, moving(2, -15.4002, 28.3, 2, 10), T0 + 2000);

  const start = T0 + 2000;
  const duration = 2000 * GLIDE_HEADROOM;
  const mid = tracker.headingAt(7, start + duration / 2);
  assert.ok(mid < 1e-6 || mid > 359.999999, `expected ~0 (north), got ${mid}`);
  assert.equal(tracker.headingAt(7, start + duration), 10);
});

test('heading: a fix arriving mid-turn re-targets from the heading drawn right now, with no jump', () => {
  const tracker = createMotionTracker();
  tracker.push(7, moving(1, -15.4000, 28.3, 0, 0), T0);
  tracker.push(7, moving(2, -15.4002, 28.3, 2, 90), T0 + 2000);
  const midway = T0 + 2000 + 1000;

  const before = tracker.headingAt(7, midway);
  tracker.push(7, moving(3, -15.4004, 28.3002, 3, 180), midway);
  assert.ok(Math.abs(tracker.headingAt(7, midway) - before) < 1e-9);
});

test('heading: a stopped vehicle keeps pointing the way it last travelled instead of snapping north', () => {
  const tracker = createMotionTracker();
  tracker.push(7, moving(1, -15.4000, 28.3, 0, 135), T0);
  tracker.push(7, moving(2, -15.4002, 28.3, 2, 135), T0 + 2000);
  // Parked: speed 0, and the tracker reports course 0.
  tracker.push(7, moving(3, -15.4002, 28.3, 8, 0, 0), T0 + 8000);

  assert.equal(tracker.headingAt(7, T0 + 20_000), 135);
});

test('heading: noise-level speed does not turn the icon either', () => {
  const tracker = createMotionTracker();
  tracker.push(7, moving(1, -15.4000, 28.3, 0, 200), T0);
  tracker.push(7, moving(2, -15.40001, 28.3, 4, 20, MIN_HEADING_SPEED_KN), T0 + 4000);
  assert.equal(tracker.headingAt(7, T0 + 10_000), 200);
});

test('heading: a vehicle that first appears while stopped uses the course it reports, else north', () => {
  const tracker = createMotionTracker();
  tracker.push(1, moving(1, -15.4, 28.3, 0, 270, 0), T0);
  tracker.push(2, { ...moving(2, -15.5, 28.4, 0, 0, 0), deviceId: 2, course: undefined }, T0);
  assert.equal(tracker.headingAt(1, T0), 270);
  assert.equal(tracker.headingAt(2, T0), 0);
});

test('heading: snaps together with an instantly-drawn position (teleport guard, disabled tracker)', () => {
  const teleport = createMotionTracker();
  teleport.push(7, moving(1, -15.4, 28.3, 0, 0), T0);
  teleport.push(7, moving(2, -14.2, 28.3, 2, 180), T0 + 2000);
  assert.equal(teleport.headingAt(7, T0 + 2000), 180);

  const off = createMotionTracker({ enabled: false });
  off.push(7, moving(1, -15.4000, 28.3, 0, 0), T0);
  off.push(7, moving(2, -15.4002, 28.3, 2, 90), T0 + 2000);
  assert.equal(off.headingAt(7, T0 + 2001), 90);
});
