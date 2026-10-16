import test from 'node:test';
import assert from 'node:assert/strict';

import FollowCameraController from './FollowCameraController.js';
import {
  DEFAULT_TRACKING_ZOOM,
  MAX_PAN_DURATION_MS,
  MIN_MOVE_INTERVAL_MS,
  PRESS_STALE_MS,
  RESUME_AFTER_MS,
  SELECT_DURATION_MS,
} from './followCamera.js';

const WIDTH = 1000;
const HEIGHT = 700;
const PX_PER_DEGREE = 200_000;
const ORIGIN = [28.28, -15.41];
const USER = { originalEvent: {} };

/** Deterministic clock: timers only run when the test advances time. */
const createClock = () => {
  let current = Date.now();
  let nextId = 0;
  let timers = [];
  return {
    now: () => current,
    setTimer: (fn, ms) => {
      nextId += 1;
      timers.push({ id: nextId, at: current + ms, fn });
      return nextId;
    },
    clearTimer: (id) => { timers = timers.filter((timer) => timer.id !== id); },
    advance(ms) {
      const target = current + ms;
      for (;;) {
        const due = timers.filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers = timers.filter((timer) => timer.id !== due.id);
        current = due.at;
        due.fn();
      }
      current = target;
    },
    pending: () => timers.length,
  };
};

/** Minimal MapLibre stand-in: records easeTo calls and keeps a camera centre. */
const createFakeMap = ({ zoom = 12 } = {}) => {
  const handlers = new Map();
  const map = {
    zoom,
    center: [...ORIGIN],
    calls: [],
    easing: false,
    emitMoveend: false,
    isEasing: () => map.easing,
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(handler);
    },
    off(type, handler) { handlers.get(type)?.delete(handler); },
    emit(type, event = {}) { handlers.get(type)?.forEach((handler) => handler(event)); },
    listenerCount: () => [...handlers.values()].reduce((sum, set) => sum + set.size, 0),
    getZoom: () => map.zoom,
    project: ([lng, lat]) => ({
      x: WIDTH / 2 + (lng - map.center[0]) * PX_PER_DEGREE,
      y: HEIGHT / 2 - (lat - map.center[1]) * PX_PER_DEGREE,
    }),
    easeTo(options) {
      map.calls.push(options);
      map.center = [...options.center];
      if (options.zoom != null) map.zoom = options.zoom;
      // MapLibre fires moveend (without a user event) when one of our moves ends.
      if (map.emitMoveend) map.emit('moveend', {});
    },
  };
  return map;
};

const SAFE = {
  left: 50, right: 950, top: 50, bottom: 650, width: 900, height: 600,
  center: { x: WIDTH / 2, y: HEIGHT / 2 }, offset: { x: 0, y: 0 },
};

const setup = (options = {}) => {
  const clock = createClock();
  const map = createFakeMap(options.map);
  const controller = new FollowCameraController({
    map,
    getSafeArea: () => SAFE,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    ...options.controller,
  });
  controller.attach();
  return { clock, map, controller };
};

let nextId = 0;
const at = (dLat, dLng, extra = {}) => {
  nextId += 1;
  return {
    id: nextId,
    deviceId: 7,
    latitude: ORIGIN[1] + dLat,
    longitude: ORIGIN[0] + dLng,
    fixTime: new Date(Date.now() - 1000).toISOString(),
    valid: true,
    ...extra,
  };
};

test('selecting a vehicle starts following immediately, at tracking zoom 16', () => {
  const { map, controller } = setup();
  controller.select(7, at(0.0005, 0.0005));

  assert.equal(map.calls.length, 1);
  assert.equal(map.calls[0].zoom, DEFAULT_TRACKING_ZOOM);
  assert.equal(map.calls[0].duration, SELECT_DURATION_MS);
  assert.deepEqual(map.calls[0].center, [ORIGIN[0] + 0.0005, ORIGIN[1] + 0.0005]);
});

test('selection does not wait for a position that has not arrived yet', () => {
  const { map, controller } = setup();
  controller.select(7, undefined);
  assert.equal(map.calls.length, 0);

  controller.update(at(0.0005, 0.0005));
  assert.equal(map.calls.length, 1, 'first usable position focuses straight away');
  assert.equal(map.calls[0].zoom, DEFAULT_TRACKING_ZOOM);
});

test('a far-away vehicle is jumped to, not panned across the world', () => {
  const { map, controller } = setup();
  controller.select(7, at(2, 2));
  assert.equal(map.calls[0].duration, 0);
});

test('follow updates pan without touching the zoom', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  clock.advance(1000);
  controller.update(at(0, 0.0008));

  assert.equal(map.calls.length, 2);
  assert.equal('zoom' in map.calls[1], false, 'tracking zoom is stable during follow');
  assert.equal(map.calls[1].duration, MAX_PAN_DURATION_MS);
});

test('a burst of positions is coalesced; the camera ends on the latest and never queues', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  clock.advance(1000);
  map.calls.length = 0;

  let last;
  for (let i = 1; i <= 25; i += 1) {
    last = at(0, 0.0003 + i * 0.0002);
    controller.update(last);
    clock.advance(10);
  }
  clock.advance(MIN_MOVE_INTERVAL_MS * 2);

  assert.ok(map.calls.length <= 4, `expected a handful of moves, got ${map.calls.length}`);
  assert.deepEqual(map.calls.at(-1).center, [last.longitude, last.latitude]);
  assert.equal(clock.pending(), 0, 'no timers left behind');
});

test('manual dragging pauses following; it resumes five seconds after the last interaction', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  clock.advance(1000);
  map.calls.length = 0;

  map.emit('dragstart', USER);
  controller.update(at(0, 0.0010));
  clock.advance(2000);
  assert.equal(map.calls.length, 0, 'paused while the user holds the map');

  map.emit('dragend', USER);
  clock.advance(RESUME_AFTER_MS - 1);
  assert.equal(map.calls.length, 0, 'still paused one millisecond before the timeout');

  clock.advance(1);
  assert.equal(map.calls.length, 1, 'resumed');
  assert.equal(map.calls[0].center[0], ORIGIN[0] + 0.0010, 'catches up to the latest position');
});

test('further interaction restarts the five-second inactivity window', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  clock.advance(1000);
  map.calls.length = 0;

  map.emit('dragstart', USER);
  map.emit('dragend', USER);
  controller.update(at(0, 0.0010));

  clock.advance(4000);
  map.emit('dragstart', USER); // the user grabs the map again
  map.emit('dragend', USER);

  clock.advance(RESUME_AFTER_MS - 1);
  assert.equal(map.calls.length, 0);
  clock.advance(1);
  assert.equal(map.calls.length, 1);
});

test('camera moves the app makes itself (no originalEvent) never pause following', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  clock.advance(1000);

  map.emit('dragstart', {});
  map.emit('moveend', {});
  controller.update(at(0, 0.0008));

  assert.equal(map.calls.length, 2);
});

test('selecting another vehicle switches immediately, even in the middle of a pause', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  clock.advance(1000);
  map.emit('dragstart', USER);
  map.emit('dragend', USER);
  map.calls.length = 0;

  const other = at(0.0004, 0.0004, { deviceId: 9 });
  controller.select(9, other);

  assert.equal(map.calls.length, 1);
  assert.deepEqual(map.calls[0].center, [other.longitude, other.latitude]);
  assert.equal(controller.isPaused(), false);
});

test('invalid positions never move the camera', () => {
  const { map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  map.calls.length = 0;

  controller.update(at(0, 0, { latitude: 0, longitude: 0 }));
  controller.update(at(0, 0, { latitude: NaN }));
  controller.update(at(0, 0, { latitude: 95 }));
  controller.update(at(0, 0.0009, { valid: false }));

  assert.equal(map.calls.length, 0);
});

test('a GPS spike is held back; the camera stays put', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  clock.advance(1000);
  map.calls.length = 0;

  controller.update(at(1.2, 0.0003)); // ~130 km away within seconds
  clock.advance(1000);
  assert.equal(map.calls.length, 0);

  controller.update(at(0, 0.0006)); // vehicle is right where it was heading
  clock.advance(1000);
  assert.equal(map.calls.length, 1);
});

test('a confirmed relocation is jumped to instantly', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  clock.advance(1000);
  map.calls.length = 0;

  controller.update(at(1.2, 0.0));
  clock.advance(500);
  controller.update(at(1.2001, 0.0001));
  clock.advance(500);

  assert.equal(map.calls.length, 1);
  assert.equal(map.calls[0].duration, 0);
});

test('a deliberate zoom becomes the tracking zoom for the next selection', () => {
  const { map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  assert.equal(map.zoom, DEFAULT_TRACKING_ZOOM);

  map.zoom = 18;
  map.emit('zoomend', USER);

  controller.select(9, at(0.0004, 0.0004, { deviceId: 9 }));
  const last = map.calls.at(-1);
  assert.equal('zoom' in last, false, 'already at the chosen zoom, so no zoom change is requested');
  assert.equal(map.zoom, 18);
});

test('with the follow preference off the camera still focuses once on selection', () => {
  const { clock, map, controller } = setup({ controller: { followEnabled: false } });
  controller.select(7, at(0, 0.0003));
  assert.equal(map.calls.length, 1);

  clock.advance(1000);
  controller.update(at(0, 0.0009));
  assert.equal(map.calls.length, 1);
});

test('older fixes of the selected vehicle do not drag the camera backwards', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003, { fixTime: new Date(Date.now()).toISOString() }));
  clock.advance(1000);
  map.calls.length = 0;

  controller.update(at(0, -0.0003, { fixTime: new Date(Date.now() - 600_000).toISOString() }));
  clock.advance(1000);
  assert.equal(map.calls.length, 0);
});

test('detach removes every listener and timer', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  map.emit('dragstart', USER);
  assert.ok(map.listenerCount() > 0);

  controller.detach();
  assert.equal(map.listenerCount(), 0);
  assert.equal(clock.pending(), 0);
});

test('re-adopting the current selection (map re-mount) keeps following without moving the camera', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  clock.advance(1000);
  map.calls.length = 0;

  // A new controller instance after a base-map switch adopts the selection.
  const remounted = setup();
  remounted.controller.select(7, at(0, 0.0003), { focus: false });
  assert.equal(remounted.map.calls.length, 0, 'no snap back to the vehicle');

  remounted.clock.advance(1000);
  remounted.controller.update(at(0, 0.0009));
  assert.equal(remounted.map.calls.length, 1, 'but the next position is followed');
});


// ---------------------------------------------------------------- smooth mode
// The marker icon glides between fixes (markerMotion). The camera then follows the
// *drawn* position every frame instead of easing towards each fix.

const createMotion = (lng = ORIGIN[0], lat = ORIGIN[1]) => {
  const motion = {
    enabled: true,
    shown: [lng, lat],
    target: [lng, lat],
    isEnabled: () => motion.enabled,
    positionAt: () => motion.shown,
    targetOf: () => motion.target,
  };
  return motion;
};

const setupSmooth = (extra = {}) => {
  const motion = createMotion();
  const ctx = setup({ controller: { motion }, ...extra });
  return { ...ctx, motion };
};

/** Select and finish the initial focus so the camera is locked on the vehicle. */
const focusOn = (ctx, fixOverrides = {}) => {
  const first = at(0, 0, fixOverrides);
  ctx.motion.shown = [first.longitude, first.latitude];
  ctx.motion.target = [first.longitude, first.latitude];
  ctx.controller.select(7, first);
  ctx.clock.advance(1000);
  ctx.map.calls.length = 0;
  return first;
};

/** The vehicle glides to a new fix: target is the fix, shown is where it is drawn now. */
const glideTo = (ctx, dLng, shownDLng) => {
  const next = at(0, dLng);
  ctx.motion.target = [next.longitude, next.latitude];
  ctx.motion.shown = [ORIGIN[0] + shownDLng, ORIGIN[1]];
  ctx.controller.update(next);
  return next;
};

test('smooth mode: a new fix never starts an animated ease towards it (it would fight the glide)', () => {
  const ctx = setupSmooth();
  focusOn(ctx);

  glideTo(ctx, 0.0010, 0.0002);
  ctx.clock.advance(1000);

  assert.ok(
    ctx.map.calls.every((call) => call.duration === 0),
    'the camera only ever locks onto the drawn icon, instantly',
  );
  assert.ok(ctx.map.calls.every((call) => call.center[0] === ORIGIN[0] + 0.0002), 'and never aims at the fix');
});

test('smooth mode: a fix the marker draws instantly (long silence, relocation) still brings the camera along', () => {
  const ctx = setupSmooth();
  focusOn(ctx);

  // After an hour of silence the vehicle is 2 km away: plausible, so the camera
  // filter accepts it, and the tracker draws it instantly (no glide, no frame loop).
  const relocated = at(0, 0.0200, { fixTime: new Date(Date.now() + 3_600_000).toISOString() });
  ctx.motion.target = [relocated.longitude, relocated.latitude];
  ctx.motion.shown = [relocated.longitude, relocated.latitude];
  ctx.controller.update(relocated);
  ctx.clock.advance(0);

  assert.equal(ctx.map.calls.length, 1);
  assert.deepEqual(ctx.map.calls[0].center, [relocated.longitude, relocated.latitude]);
  assert.equal(ctx.map.calls[0].duration, 0);
});

test('smooth mode: settling after a normal fix is a no-op because the glide starts where the icon is', () => {
  const ctx = setupSmooth();
  focusOn(ctx);

  glideTo(ctx, 0.0010, 0); // icon still drawn at the centre
  ctx.clock.advance(0);

  assert.equal(ctx.map.calls.length, 0);
});

test('smooth mode: each frame puts the drawn vehicle at the centre of the safe area, instantly', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.controller.frame();

  assert.equal(ctx.map.calls.length, 1);
  const call = ctx.map.calls[0];
  assert.equal(call.duration, 0, 'a per-frame move must not be an animation of its own');
  assert.deepEqual(call.center, [ORIGIN[0] + 0.0002, ORIGIN[1]], 'centres the DRAWN position, not the fix');
  assert.equal('zoom' in call, false, 'tracking zoom is never touched');
});

test('smooth mode: successive frames follow the glide step by step with no lag build-up', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0001);

  const centres = [];
  for (let i = 1; i <= 4; i += 1) {
    ctx.motion.shown = [ORIGIN[0] + 0.0001 * i, ORIGIN[1]];
    ctx.controller.frame();
    centres.push(ctx.map.calls.at(-1).center[0]);
  }

  assert.deepEqual(centres, [0.0001, 0.0002, 0.0003, 0.0004].map((d) => ORIGIN[0] + d));
  assert.equal(ctx.map.calls.length, 4, 'exactly one move per frame, nothing queued');
});

test('smooth mode: a frame with the vehicle already centred does nothing', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0);
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, 0);
});

test('smooth mode: no frame moves while the user has the map', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.emit('dragstart', USER);
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, 0);

  ctx.map.emit('dragend', USER);
  ctx.clock.advance(RESUME_AFTER_MS - 1);
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, 0, 'still paused one millisecond early');
});

test('smooth mode: after five quiet seconds the camera glides back to the drawn vehicle', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);
  ctx.map.emit('dragstart', USER);
  ctx.map.emit('dragend', USER);

  ctx.clock.advance(RESUME_AFTER_MS);

  assert.equal(ctx.map.calls.length, 1);
  assert.deepEqual(ctx.map.calls[0].center, [ORIGIN[0] + 0.0002, ORIGIN[1]]);
  assert.ok(ctx.map.calls[0].duration > 0, 'resume is an ease, not a snap');
});

test('smooth mode: frames wait while the camera is still easing (initial focus)', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.easing = true;
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, 0);

  ctx.map.easing = false;
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, 1);
});

test('smooth mode: the initial focus aims at where the icon is drawn, not at the raw fix', () => {
  const ctx = setupSmooth();
  const fixAt = at(0, 0.0008);
  ctx.motion.shown = [ORIGIN[0] + 0.0003, ORIGIN[1]];
  ctx.motion.target = [fixAt.longitude, fixAt.latitude];

  ctx.controller.select(7, fixAt);

  assert.deepEqual(ctx.map.calls[0].center, [ORIGIN[0] + 0.0003, ORIGIN[1]]);
  assert.equal(ctx.map.calls[0].zoom, DEFAULT_TRACKING_ZOOM);
});

test('smooth mode: a held GPS outlier is drawn by the marker but never drags the camera', () => {
  const ctx = setupSmooth();
  focusOn(ctx);

  // The marker snaps to a far-away spike; the controller's filter holds it.
  const spike = at(1.2, 0.0003);
  ctx.motion.target = [spike.longitude, spike.latitude];
  ctx.motion.shown = [spike.longitude, spike.latitude];
  ctx.controller.update(spike);
  ctx.controller.frame();

  assert.equal(ctx.map.calls.length, 0);
});

test('smooth mode: finishing one of our own eases re-centres once and cannot loop', () => {
  const ctx = setupSmooth();
  ctx.map.emitMoveend = true; // a real map fires moveend after every move, including per-frame ones
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.emit('moveend', {}); // our focus ease just finished

  assert.equal(ctx.map.calls.length, 1, 'one correction, then the moveend it causes is a no-op');
});

test('smooth mode: a user gesture ending is not mistaken for one of our own', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.emit('moveend', USER);

  assert.equal(ctx.map.calls.length, 0, 'paused by the gesture, so nothing is re-centred');
});

test('smooth mode: with following switched off the camera is left alone', () => {
  const ctx = setupSmooth({ controller: { followEnabled: false } });
  const first = at(0, 0.0003);
  ctx.motion.shown = [first.longitude, first.latitude];
  ctx.motion.target = [first.longitude, first.latitude];
  ctx.controller.select(7, first);
  ctx.map.calls.length = 0;

  glideTo(ctx, 0.0010, 0.0002);
  ctx.controller.frame();

  assert.equal(ctx.map.calls.length, 0);
});

test('when the motion tracker is off the camera falls back to easing towards each fix', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  ctx.motion.enabled = false;

  ctx.controller.update(at(0, 0.0008));
  ctx.clock.advance(1000);
  ctx.controller.update(at(0, 0.0012));

  assert.ok(ctx.map.calls.length >= 1, 'classic follow still moves the camera');
  ctx.controller.frame();
  const before = ctx.map.calls.length;
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, before, 'and the frame lock stays out of the way');
});

test('a vehicle the tracker is not drawing (filtered out of view) is still followed by easing', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  ctx.motion.targetOf = () => null; // tracker has no entry for this device

  ctx.clock.advance(1000);
  ctx.controller.update(at(0, 0.0009));

  assert.ok(ctx.map.calls.length >= 1);
});


// ---------------------------------------------------------- pointer handling
// MapLibre's easeTo/jumpTo reset every gesture handler. A camera call between a
// press and the first drag movement therefore kills the drag before it starts
// (found with a real browser: the map could not be dragged while following).

const touchEvent = (touchesLeft) => ({ originalEvent: { touches: { length: touchesLeft } } });

test('pointer: no camera call is made from the moment the map is pressed, before any drag', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.emit('mousedown', USER);
  ctx.controller.frame();

  assert.equal(ctx.map.calls.length, 0);
});

test('pointer: the classic (non-smooth) follow also holds off while the map is pressed', () => {
  const { clock, map, controller } = setup();
  controller.select(7, at(0, 0.0003));
  clock.advance(1000);
  map.calls.length = 0;

  map.emit('mousedown', USER);
  controller.update(at(0, 0.0009));
  clock.advance(500);

  assert.equal(map.calls.length, 0);
});

test('pointer: a plain click that never becomes a gesture does not cost a five-second pause', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.emit('mousedown', USER);
  ctx.map.emit('mouseup', USER);
  ctx.controller.frame();

  assert.equal(ctx.map.calls.length, 1, 'following carries on straight away');
});

test('pointer: releasing after a real drag starts the five-second window', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.emit('mousedown', USER);
  ctx.map.emit('dragstart', USER);
  ctx.map.emit('dragend', USER);
  ctx.map.emit('mouseup', USER);

  ctx.clock.advance(RESUME_AFTER_MS - 1);
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, 0);
  ctx.clock.advance(1);
  assert.equal(ctx.map.calls.length, 1, 'resumed after five quiet seconds');
});

test('pointer: with two fingers down, lifting one does not release the map', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.emit('touchstart', touchEvent(1));
  ctx.map.emit('touchstart', touchEvent(2));
  ctx.map.emit('touchend', touchEvent(1)); // one finger still on the glass
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, 0);

  ctx.map.emit('touchend', touchEvent(0));
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, 1);
});

test('pointer: a release that is never delivered cannot freeze following forever', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.emit('mousedown', USER); // button released outside the window: no mouseup arrives
  ctx.clock.advance(PRESS_STALE_MS - 1);
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, 0);

  ctx.clock.advance(1);
  ctx.controller.frame();
  assert.equal(ctx.map.calls.length, 1);
});

test('pointer: wheel zoom pauses immediately, before the zoom gesture has even started', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.emit('wheel', USER);
  ctx.controller.frame();

  assert.equal(ctx.map.calls.length, 0);
  assert.equal(ctx.controller.isPaused(), true);
});

test('pointer: selecting a vehicle clears a stuck press', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  ctx.map.emit('mousedown', USER);

  const other = at(0.0004, 0.0004, { deviceId: 9 });
  ctx.motion.shown = [other.longitude, other.latitude];
  ctx.motion.target = [other.longitude, other.latitude];
  ctx.controller.select(9, other);

  assert.equal(ctx.controller.isPaused(), false);
  assert.equal(ctx.map.calls.length, 1, 'focus on the new vehicle is immediate');
});

test('pointer: events that are not from a person never count as a press', () => {
  const ctx = setupSmooth();
  focusOn(ctx);
  glideTo(ctx, 0.0010, 0.0002);

  ctx.map.emit('mousedown', {});
  ctx.controller.frame();

  assert.equal(ctx.map.calls.length, 1);
});
