import test from 'node:test';
import assert from 'node:assert/strict';

import { FRAME_INTERVAL_MS, createFrameLoop } from './motionFrameLoop.js';

/** Manual rAF: frames only run when the test advances time. */
const setup = ({ activeUntil = Infinity } = {}) => {
  let clock = 0;
  let nextHandle = 0;
  const queue = new Map();
  const calls = [];
  const loop = createFrameLoop({
    isActive: (now) => now < activeUntil,
    requestFrame: (callback) => { nextHandle += 1; queue.set(nextHandle, callback); return nextHandle; },
    cancelFrame: (handle) => queue.delete(handle),
    now: () => clock,
  });
  loop.subscribe((t) => calls.push(t));
  return {
    loop,
    calls,
    pending: () => queue.size,
    /** Run one animation frame at `t`. */
    frame(t) {
      clock = t;
      const [handle, callback] = [...queue.entries()][0] ?? [];
      if (handle == null) return false;
      queue.delete(handle);
      callback();
      return true;
    },
    setClock(t) { clock = t; },
  };
};

test('nothing is scheduled while nothing is animating', () => {
  const { loop, pending } = setup({ activeUntil: 0 });
  loop.kick();
  assert.equal(pending(), 0);
});

test('kick starts the loop once, however many times it is called', () => {
  const { loop, pending } = setup();
  loop.kick();
  loop.kick();
  loop.kick();
  assert.equal(pending(), 1);
});

test('subscribers run together and the loop keeps itself going while active', () => {
  const { loop, calls, frame, pending } = setup();
  loop.kick();
  frame(40);
  frame(80);
  assert.deepEqual(calls, [40, 80]);
  assert.equal(pending(), 1);
});

test('frames closer together than the frame interval are skipped', () => {
  const { loop, calls, frame } = setup();
  loop.kick();
  frame(100);
  frame(110); // 10 ms later
  frame(120);
  frame(100 + FRAME_INTERVAL_MS);
  assert.deepEqual(calls, [100, 100 + FRAME_INTERVAL_MS]);
});

test('the final frame of a glide is always delivered, then the loop stops', () => {
  const { loop, calls, frame, pending } = setup({ activeUntil: 105 });
  loop.kick();
  frame(100); // active, delivered
  frame(104); // active, throttled
  frame(106); // no longer active: must still be delivered so motion ends on target
  assert.deepEqual(calls, [100, 106]);
  assert.equal(pending(), 0, 'no timer left once idle');
});

test('unsubscribing stops delivery', () => {
  const { loop, frame } = setup();
  const seen = [];
  const off = loop.subscribe((t) => seen.push(t));
  loop.kick();
  frame(100);
  off();
  frame(200);
  assert.deepEqual(seen, [100]);
});

test('stop cancels a scheduled frame', () => {
  const { loop, pending } = setup();
  loop.kick();
  loop.stop();
  assert.equal(pending(), 0);
});
