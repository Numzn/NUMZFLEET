/**
 * Live propagation, end to end (no React, no real clock): tracker positions arrive -> the signal source decides
 * whether mileage may have changed -> each screen's consumer decides whether, and how soon, to ask fuel-api again.
 * The numbers themselves are never computed here; the only thing under test is WHEN a refresh happens.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createMileageSignalSource, emitMileageSignal, subscribeMileageSignal } from './mileageSignal.js';
import { createMileageConsumer } from './mileageConsumer.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** One manual clock shared by the source and every consumer, so timers fire in true order. */
function world() {
  let nowMs = 1_000_000;
  let seq = 0;
  const timers = new Map();
  const clock = {
    now: () => nowMs,
    setTimer: (fn, ms) => { seq += 1; timers.set(seq, { fn, at: nowMs + ms }); return seq; },
    clearTimer: (id) => timers.delete(id),
    async advance(ms) {
      const target = nowMs + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        nowMs = due[1].at;
        due[1].fn();
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
      }
      nowMs = target;
    },
  };

  const listeners = new Set();
  const bus = {
    emit: (signal) => [...listeners].forEach((l) => l(signal)),
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };

  const source = createMileageSignalSource({
    emit: bus.emit, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });

  let hidden = false;
  const consumers = [];
  const consumer = (deviceId = null, refresh = async () => {}) => {
    const calls = [];
    const c = createMileageConsumer({
      refresh: async () => { calls.push(clock.now()); await refresh(); },
      deviceId,
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      isHidden: () => hidden,
      subscribe: bus.subscribe,
    });
    consumers.push(c);
    return { calls, c };
  };

  /** A tracker report: totalDistance in metres, like Traccar's position attribute. */
  const positions = {};
  const report = (deviceId, km) => {
    positions[deviceId] = { deviceId, attributes: { totalDistance: km * 1000 } };
    source.positions({ ...positions });
  };
  /** The initial snapshot: every vehicle at once, which is the baseline the initial load already reflects. */
  const seed = (kmByDevice) => {
    Object.entries(kmByDevice).forEach(([id, km]) => {
      positions[id] = { deviceId: Number(id), attributes: { totalDistance: km * 1000 } };
    });
    source.positions({ ...positions });
  };

  return {
    clock, source, bus, consumer, report, seed,
    setHidden: (value) => { hidden = value; },
    dispose: () => { consumers.forEach((c) => c.dispose()); source.dispose(); },
  };
}

test('a vehicle that starts driving updates its screens within seconds, with one request, not one per position', async () => {
  const w = world();
  const fleet = w.consumer(null);
  const own = w.consumer(7);
  w.report(7, 1000); // baseline: the initial load already reflects this

  await w.clock.advance(60 * SECOND);
  w.report(7, 1000.4); // the first movement
  await w.clock.advance(2 * SECOND);
  w.report(7, 1000.8);
  w.report(7, 1001.2);
  await w.clock.advance(10 * SECOND);

  assert.equal(fleet.calls.length, 1, 'fleet-wide screen: one refresh for the whole burst');
  assert.equal(own.calls.length, 1, 'the vehicle\'s own workspace: one refresh');
  assert.ok(fleet.calls[0] - (1_000_000 + 60 * SECOND) <= 5 * SECOND + 1, 'and it arrives within the 5 s debounce');
  w.dispose();
});

test('ten minutes of continuous driving costs a bounded number of requests', async () => {
  const w = world();
  const fleet = w.consumer(null);
  w.report(7, 1000);
  let km = 1000;
  for (let s = 0; s < 600; s += 5) { km += 0.15; w.report(7, km); await w.clock.advance(5 * SECOND); }
  await w.clock.advance(35 * SECOND);

  assert.ok(fleet.calls.length >= 15, `the screen keeps up while the vehicle moves (got ${fleet.calls.length})`);
  assert.ok(fleet.calls.length <= 21, `but never faster than one per 30 s (got ${fleet.calls.length})`);
  for (let i = 1; i < fleet.calls.length; i += 1) {
    assert.ok(fleet.calls[i] - fleet.calls[i - 1] >= 30 * SECOND - 1, 'rate floor holds');
  }
  w.dispose();
});

test('another vehicle driving does not refresh a screen that shows only this one', async () => {
  const w = world();
  const own = w.consumer(7);
  const other = w.consumer(8);
  w.seed({ 7: 1000, 8: 2000 });
  await w.clock.advance(MINUTE);
  w.report(8, 2000.5);
  await w.clock.advance(MINUTE);
  assert.equal(own.calls.length, 0);
  assert.equal(other.calls.length, 1);
  w.dispose();
});

test('a stationary vehicle (counter not moving) costs nothing, however many positions it sends', async () => {
  const w = world();
  const fleet = w.consumer(null);
  w.report(7, 1000);
  for (let i = 0; i < 100; i += 1) { w.report(7, 1000.02); await w.clock.advance(10 * SECOND); }
  assert.equal(fleet.calls.length, 0);
  w.dispose();
});

test('after the live connection drops and returns, screens catch up promptly even though they refreshed moments ago', async () => {
  const w = world();
  const fleet = w.consumer(null);
  w.source.socket(true);
  w.report(7, 1000);
  await w.clock.advance(MINUTE);
  w.report(7, 1001); // a normal refresh
  await w.clock.advance(6 * SECOND);
  assert.equal(fleet.calls.length, 1);

  w.source.socket(false);
  await w.clock.advance(7 * SECOND);
  w.source.socket(true); // reconnected
  await w.clock.advance(6 * SECOND);
  assert.equal(fleet.calls.length, 2, 'urgent: waits only the short floor, not the 30 s one');
  w.dispose();
});

test('a flapping connection cannot hammer the API', async () => {
  const w = world();
  const fleet = w.consumer(null);
  w.source.socket(true);
  for (let i = 0; i < 20; i += 1) {
    w.source.socket(false);
    await w.clock.advance(SECOND);
    w.source.socket(true);
    await w.clock.advance(SECOND);
  }
  await w.clock.advance(10 * SECOND);
  assert.ok(fleet.calls.length <= 5, `got ${fleet.calls.length} refreshes for 20 reconnects in 40 s`);
  for (let i = 1; i < fleet.calls.length; i += 1) assert.ok(fleet.calls[i] - fleet.calls[i - 1] >= 10 * SECOND - 1);
  w.dispose();
});

test('with the live connection healthy nothing polls at all', async () => {
  const w = world();
  const fleet = w.consumer(null);
  w.source.socket(true);
  w.report(7, 1000);
  await w.clock.advance(30 * MINUTE);
  assert.equal(fleet.calls.length, 0);
  w.dispose();
});

test('with the live connection down, a visible screen falls back to a slow re-check', async () => {
  const w = world();
  const fleet = w.consumer(null);
  w.source.socket(true);
  w.source.socket(false);
  await w.clock.advance(10 * MINUTE);
  assert.ok(fleet.calls.length >= 4 && fleet.calls.length <= 6, `about one per 2 min, got ${fleet.calls.length}`);
  w.dispose();
});

test('a hidden tab spends nothing, then catches up the moment it is shown', async () => {
  const w = world();
  const fleet = w.consumer(null);
  w.report(7, 1000);
  w.setHidden(true);
  w.source.visible(false);
  await w.clock.advance(MINUTE);
  w.report(7, 1002);
  await w.clock.advance(5 * MINUTE);
  assert.equal(fleet.calls.length, 0, 'nothing while hidden');

  w.setHidden(false);
  w.source.visible(true);
  await w.clock.advance(6 * SECOND);
  assert.equal(fleet.calls.length, 1, 'refreshed on return');
  w.dispose();
});

test('coming back to a tab that missed nothing and is fresh does not refresh', async () => {
  const w = world();
  const fleet = w.consumer(null);
  await w.clock.advance(10 * SECOND);
  w.source.visible(false);
  w.source.visible(true);
  await w.clock.advance(10 * SECOND);
  assert.equal(fleet.calls.length, 0);
  w.dispose();
});

test('a failed refresh does not stop the next one, and never throws into the live feed', async () => {
  const w = world();
  let attempts = 0;
  const fleet = w.consumer(null, async () => { attempts += 1; if (attempts === 1) throw new Error('network down'); });
  w.report(7, 1000);
  w.report(7, 1001);
  await w.clock.advance(6 * SECOND);
  w.report(7, 1002);
  await w.clock.advance(35 * SECOND);
  assert.equal(fleet.calls.length, 2, 'retried on the next change');
  w.dispose();
});

test('the shared app-wide bus carries the same signals to every subscribed screen', async () => {
  const seen = [];
  const off = subscribeMileageSignal((s) => seen.push(s.reason));
  const w = world();
  const sourceOnRealBus = createMileageSignalSource({ emit: emitMileageSignal });
  sourceOnRealBus.positions({ 1: { deviceId: 1, attributes: { totalDistance: 1000000 } } });
  sourceOnRealBus.positions({ 1: { deviceId: 1, attributes: { totalDistance: 1000500 } } });
  sourceOnRealBus.online();
  off();
  sourceOnRealBus.dispose();
  w.dispose();
  assert.deepEqual(seen, ['counter', 'online']);
});
