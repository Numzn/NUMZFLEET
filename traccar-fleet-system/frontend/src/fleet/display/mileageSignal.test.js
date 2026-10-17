import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FALLBACK_REFRESH_MS,
  changedDevices,
  classifySignal,
  createMileageSignalSource,
  emitMileageSignal,
  subscribeMileageSignal,
} from './mileageSignal.js';
import { mileageStepsByDevice } from './registryRefreshPolicy.js';

const pos = (deviceId, totalDistance, extra = {}) => ({ deviceId, attributes: { totalDistance, ...extra } });

function fakeTimers() {
  let nowMs = 0;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => nowMs,
    setTimer: (fn, ms) => { seq += 1; timers.set(seq, { fn, at: nowMs + ms }); return seq; },
    clearTimer: (id) => timers.delete(id),
    count: () => timers.size,
    advance(ms) {
      const target = nowMs + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        nowMs = due[1].at;
        due[1].fn();
      }
      nowMs = target;
    },
  };
}

function makeSource(extra = {}) {
  const t = fakeTimers();
  const signals = [];
  const source = createMileageSignalSource({
    emit: (s) => signals.push(s), now: t.now, setTimer: t.setTimer, clearTimer: t.clearTimer, ...extra,
  });
  return { t, signals, source };
}

// ---- per-device steps ----

test('steps are tracked per device so only the vehicles that moved are named', () => {
  const a = mileageStepsByDevice({ 1: pos(1, 12000), 2: pos(2, 5000) });
  const b = mileageStepsByDevice({ 1: pos(1, 12100), 2: pos(2, 5000) });
  assert.deepEqual(changedDevices(a, b), [1]);
});

test('a device that appears after the baseline counts as changed; one that vanishes does not', () => {
  const a = mileageStepsByDevice({ 1: pos(1, 12000) });
  const b = mileageStepsByDevice({ 1: pos(1, 12000), 3: pos(3, 900) });
  assert.deepEqual(changedDevices(a, b), [3]);
  assert.deepEqual(changedDevices(b, a), []);
});

// ---- the source ----

test('the first positions are the baseline: they signal nothing', () => {
  const { signals, source } = makeSource();
  source.positions({ 1: pos(1, 12000) });
  assert.deepEqual(signals, []);
});

test('an empty first snapshot (positions not loaded yet) is still only a baseline: the first real snapshot signals nothing', () => {
  const { signals, source } = makeSource();
  source.positions({});
  source.positions({ 1: pos(1, 12000), 2: pos(2, 5000) });
  assert.deepEqual(signals, [], 'otherwise every vehicle would trigger a pointless refresh at startup');
  source.positions({ 1: pos(1, 12200), 2: pos(2, 5000) });
  assert.deepEqual(signals, [{ reason: 'counter', deviceIds: [1] }]);
});

test('a counter advance signals exactly the devices that moved', () => {
  const { signals, source } = makeSource();
  source.positions({ 1: pos(1, 12000), 2: pos(2, 5000) });
  source.positions({ 1: pos(1, 12150), 2: pos(2, 5000) });
  assert.deepEqual(signals, [{ reason: 'counter', deviceIds: [1] }]);
});

test('sub-step jitter and unrelated attribute changes signal nothing', () => {
  const { signals, source } = makeSource();
  source.positions({ 1: pos(1, 12010, { ignition: false }) });
  source.positions({ 1: pos(1, 12090, { ignition: true }) });
  assert.deepEqual(signals, []);
});

test('reconnecting after an observed disconnect signals a reconnect; the first connect does not', () => {
  const { signals, source } = makeSource();
  source.socket(null);
  source.socket(true);
  assert.deepEqual(signals, [], 'the initial connect is covered by the initial load');
  source.socket(false);
  source.socket(true);
  assert.deepEqual(signals, [{ reason: 'reconnect' }]);
});

test('coming back online and showing the tab each signal once', () => {
  const { signals, source } = makeSource();
  source.online();
  source.visible(false);
  source.visible(true);
  assert.deepEqual(signals, [{ reason: 'online' }, { reason: 'visible' }]);
});

test('while the live connection is down a visible tab gets a slow fallback signal, and only then', () => {
  const { t, signals, source } = makeSource();
  source.socket(true);
  t.advance(FALLBACK_REFRESH_MS * 3);
  assert.deepEqual(signals, [], 'connected: no polling at all');

  source.socket(false);
  t.advance(FALLBACK_REFRESH_MS);
  assert.deepEqual(signals, [{ reason: 'fallback' }]);
  t.advance(FALLBACK_REFRESH_MS);
  assert.equal(signals.filter((s) => s.reason === 'fallback').length, 2, 'repeats while still down');

  source.socket(true);
  const before = signals.length;
  t.advance(FALLBACK_REFRESH_MS * 3);
  assert.equal(signals.slice(before).filter((s) => s.reason === 'fallback').length, 0, 'stops once reconnected');
  assert.equal(t.count(), 0, 'and leaves no timer behind');
});

test('a hidden tab does not poll even while disconnected, and resumes when shown', () => {
  const { t, signals, source } = makeSource();
  source.socket(false);
  source.visible(false);
  t.advance(FALLBACK_REFRESH_MS * 3);
  assert.deepEqual(signals, []);
  source.visible(true);
  t.advance(FALLBACK_REFRESH_MS);
  assert.deepEqual(signals.map((s) => s.reason), ['visible', 'fallback']);
});

test('dispose stops the fallback timer', () => {
  const { t, source } = makeSource();
  source.socket(false);
  assert.equal(t.count(), 1);
  source.dispose();
  assert.equal(t.count(), 0);
});

// ---- the bus ----

test('subscribers receive emitted signals until they unsubscribe', () => {
  const got = [];
  const off = subscribeMileageSignal((s) => got.push(s));
  emitMileageSignal({ reason: 'counter', deviceIds: [7] });
  off();
  emitMileageSignal({ reason: 'counter', deviceIds: [8] });
  assert.deepEqual(got, [{ reason: 'counter', deviceIds: [7] }]);
});

test('one failing subscriber cannot stop the others', () => {
  const got = [];
  const offBad = subscribeMileageSignal(() => { throw new Error('bad consumer'); });
  const offGood = subscribeMileageSignal((s) => got.push(s.reason));
  emitMileageSignal({ reason: 'online' });
  offBad(); offGood();
  assert.deepEqual(got, ['online']);
});

// ---- how a consumer reacts ----

const ctx = (extra = {}) => ({
  deviceId: null, lastLoadedAt: 1_000_000, now: 1_005_000, skippedWhileHidden: false, ...extra,
});

test('a counter change for any vehicle refreshes a fleet-wide consumer, normally', () => {
  assert.equal(classifySignal({ reason: 'counter', deviceIds: [4] }, ctx()), 'normal');
});

test('a single-vehicle consumer ignores other vehicles and reacts to its own', () => {
  assert.equal(classifySignal({ reason: 'counter', deviceIds: [4] }, ctx({ deviceId: 9 })), 'ignore');
  assert.equal(classifySignal({ reason: 'counter', deviceIds: [4, 9] }, ctx({ deviceId: '9' })), 'normal');
});

test('reconnect and coming back online are urgent', () => {
  assert.equal(classifySignal({ reason: 'reconnect' }, ctx()), 'urgent');
  assert.equal(classifySignal({ reason: 'online' }, ctx()), 'urgent');
});

test('showing the tab refreshes only stale data, or data that missed a change while hidden', () => {
  assert.equal(classifySignal({ reason: 'visible' }, ctx()), 'ignore', 'loaded 5 s ago');
  assert.equal(classifySignal({ reason: 'visible' }, ctx({ now: 1_000_000 + 120_000 })), 'urgent', 'two minutes old');
  assert.equal(classifySignal({ reason: 'visible' }, ctx({ skippedWhileHidden: true })), 'urgent', 'missed a change');
  assert.equal(classifySignal({ reason: 'visible' }, ctx({ lastLoadedAt: 0 })), 'urgent', 'never loaded');
});

test('fallback ticks refresh normally; unknown signals are ignored', () => {
  assert.equal(classifySignal({ reason: 'fallback' }, ctx()), 'normal');
  assert.equal(classifySignal({ reason: 'something-else' }, ctx()), 'ignore');
  assert.equal(classifySignal(null, ctx()), 'ignore');
});
