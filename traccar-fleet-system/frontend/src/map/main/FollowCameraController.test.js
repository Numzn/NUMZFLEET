import test from 'node:test';
import assert from 'node:assert/strict';

import FollowCameraController from './FollowCameraController.js';
import {
  DEFAULT_TRACKING_ZOOM,
  MAX_PAN_DURATION_MS,
  MIN_MOVE_INTERVAL_MS,
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
