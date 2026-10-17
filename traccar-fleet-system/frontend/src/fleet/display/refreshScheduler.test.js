import test from 'node:test';
import assert from 'node:assert/strict';

import { createRefreshScheduler } from './refreshScheduler.js';

/** A hand-driven clock: timers fire only when the test advances time. */
function fakeClock(start = 1_000_000) {
  let nowMs = start;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => nowMs,
    setTimer: (fn, ms) => { seq += 1; timers.set(seq, { fn, at: nowMs + ms }); return seq; },
    clearTimer: (id) => { timers.delete(id); },
    pending: () => timers.size,
    async advance(ms) {
      const target = nowMs + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, t] = due;
        timers.delete(id);
        nowMs = Math.max(nowMs, t.at);
        t.fn(); // not awaited: a run that is still in flight must not block the clock
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
      }
      nowMs = target;
    },
  };
}

function make(overrides = {}) {
  const clock = fakeClock();
  const calls = [];
  const scheduler = createRefreshScheduler({
    run: async () => { calls.push(clock.now()); },
    debounceMs: 5000,
    minIntervalMs: 30000,
    urgentMinIntervalMs: 5000,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    ...overrides,
  });
  return { clock, calls, scheduler };
}

test('a burst of notifications costs one run, after the debounce', async () => {
  const { clock, calls, scheduler } = make();
  for (let i = 0; i < 20; i += 1) { scheduler.notify(); await clock.advance(100); }
  assert.equal(calls.length, 0, 'nothing yet: still inside the window');
  await clock.advance(5000);
  assert.equal(calls.length, 1);
});

test('a steady stream of notifications cannot starve the run (the window is not pushed back)', async () => {
  const { clock, calls, scheduler } = make();
  // a moving vehicle reports every second for two minutes
  for (let s = 0; s < 120; s += 1) { scheduler.notify(); await clock.advance(1000); }
  assert.ok(calls.length >= 3, `expected regular runs while notifications keep arriving, got ${calls.length}`);
  // and never more often than the floor
  for (let i = 1; i < calls.length; i += 1) assert.ok(calls[i] - calls[i - 1] >= 30000, 'respects the minimum interval');
});

test('after a run the next one waits for the minimum interval, however early the notification', async () => {
  const { clock, calls, scheduler } = make();
  scheduler.notify();
  await clock.advance(5000);
  assert.equal(calls.length, 1);
  await clock.advance(1000);
  scheduler.notify();
  await clock.advance(10000);
  assert.equal(calls.length, 1, 'still inside the 30 s floor');
  await clock.advance(20000);
  assert.equal(calls.length, 2);
});

test('an urgent notification (reconnect) runs sooner than a normal one, but not in a tight loop', async () => {
  const { clock, calls, scheduler } = make();
  scheduler.notify();
  await clock.advance(5000);
  assert.equal(calls.length, 1);
  await clock.advance(1000);
  scheduler.notify({ urgent: true });
  await clock.advance(4000); // 5 s after the last run
  assert.equal(calls.length, 2, 'urgent only honours the short floor');
  scheduler.notify({ urgent: true });
  scheduler.notify({ urgent: true });
  await clock.advance(1000);
  assert.equal(calls.length, 2, 'a flapping connection cannot hammer the API');
});

test('an urgent notification pulls forward a normal one that is already waiting', async () => {
  const { clock, calls, scheduler } = make();
  scheduler.notify();
  await clock.advance(5000); // run 1
  await clock.advance(1000);
  scheduler.notify(); // would wait until 30 s after run 1
  scheduler.notify({ urgent: true });
  await clock.advance(4000);
  assert.equal(calls.length, 2);
});

test('a notification that arrives while a run is in flight triggers exactly one follow-up', async () => {
  const clock = fakeClock();
  const calls = [];
  let release;
  const scheduler = createRefreshScheduler({
    run: () => new Promise((resolve) => { calls.push(clock.now()); release = resolve; }),
    debounceMs: 5000, minIntervalMs: 30000, urgentMinIntervalMs: 5000,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  scheduler.notify();
  await clock.advance(5000);
  assert.equal(calls.length, 1);
  scheduler.notify(); scheduler.notify(); scheduler.notify();
  await clock.advance(60000);
  assert.equal(calls.length, 1, 'never overlaps itself');
  release();
  await Promise.resolve(); await Promise.resolve();
  await clock.advance(30000);
  assert.equal(calls.length, 2, 'one follow-up, not three');
});

test('a failing run does not break later runs', async () => {
  const clock = fakeClock();
  const calls = [];
  const errors = [];
  const scheduler = createRefreshScheduler({
    run: async () => { calls.push(clock.now()); if (calls.length === 1) throw new Error('boom'); },
    onError: (e) => errors.push(e.message),
    debounceMs: 5000, minIntervalMs: 30000, urgentMinIntervalMs: 5000,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  scheduler.notify();
  await clock.advance(5000);
  scheduler.notify();
  await clock.advance(30000);
  assert.deepEqual(errors, ['boom']);
  assert.equal(calls.length, 2);
});

test('cancel drops the pending run and leaves nothing scheduled', async () => {
  const { clock, calls, scheduler } = make();
  scheduler.notify();
  scheduler.cancel();
  assert.equal(clock.pending(), 0);
  await clock.advance(120000);
  assert.equal(calls.length, 0);
  scheduler.notify();
  await clock.advance(5000);
  assert.equal(calls.length, 1, 'still usable after cancel');
});

test('markRan records a refresh made elsewhere, so the floor applies to it too', async () => {
  const { clock, calls, scheduler } = make();
  scheduler.markRan(); // e.g. the user pressed reload
  scheduler.notify();
  await clock.advance(10000);
  assert.equal(calls.length, 0);
  await clock.advance(20000);
  assert.equal(calls.length, 1);
});
