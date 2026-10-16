import {
  DEFAULT_TRACKING_ZOOM,
  JUMP_VIEWPORT_FRACTION,
  MAX_PAN_DURATION_MS,
  MIN_MOVE_INTERVAL_MS,
  MIN_MOVE_PX,
  MIN_PAN_DURATION_MS,
  PRESS_STALE_MS,
  RESUME_AFTER_MS,
  SELECT_DURATION_MS,
  createFixFilter,
  isValidFollowFix,
} from './followCamera.js';

const easeOutQuad = (t) => t * (2 - t);

/** While locked on a gliding vehicle, corrections smaller than this are ignored. */
const FRAME_LOCK_MIN_PX = 0.5;

/** Camera events a person causes (they carry `originalEvent`); our own moves do not. */
const INTERACTION_START = ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart'];
const INTERACTION_CONTINUE = ['drag'];
const INTERACTION_END = ['dragend', 'zoomend', 'rotateend', 'pitchend'];

const sameFix = (a, b) => Boolean(a && b)
  && a.id === b.id && a.latitude === b.latitude && a.longitude === b.longitude;

/**
 * Keeps the camera on the selected vehicle.
 *
 * It only ever *moves the camera*. Marker data is written elsewhere
 * (EnhancedMarkers), so a slow or interrupted camera animation can never delay
 * where a marker is drawn.
 *
 * `map` is duck-typed (on/off/easeTo/project/getZoom/isEasing) so the controller
 * can be tested with a fake; `getSafeArea()` returns a computeSafeArea() result.
 *
 * Optional `motion` ({ isEnabled, positionAt(id), targetOf(id) }) is the marker
 * motion tracker. When it is enabled the vehicle icon glides between fixes, so
 * the camera must follow the *drawn* position every frame (`frame()`): easing the
 * camera towards each fix separately would make the icon wobble on screen.
 */
export default class FollowCameraController {
  constructor({
    map,
    getSafeArea,
    now = () => Date.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle),
    trackingZoom = DEFAULT_TRACKING_ZOOM,
    followEnabled = true,
    motion = null,
  }) {
    this.map = map;
    this.getSafeArea = getSafeArea;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.trackingZoom = trackingZoom;
    this.followEnabled = followEnabled;
    this.motion = motion;

    this.selectedId = null;
    this.latest = null; // newest valid position of the selected vehicle
    this.filter = createFixFilter();
    this.needsFocus = false; // selected, but no usable position seen yet

    this.interacting = false;
    this.pressed = false; // a pointer is down on the map (drag may be about to start)
    this.pressedAt = 0;
    this.gesture = false; // a drag/zoom/rotate/pitch happened during this press
    this.lastInteractionAt = null;
    this.resumeTimer = null;

    this.lastMoveAt = 0;
    this.lastMovedFix = null;
    this.moveTimer = null;
    this.settleTimer = null;

    this.framing = false;

    this.listeners = [];
  }

  // ------------------------------------------------------------- lifecycle

  attach() {
    const onUser = (handler) => (event) => {
      if (event && event.originalEvent) handler(event);
    };
    const start = onUser(() => { this.interacting = true; this.gesture = true; this.touch(); });
    const keep = onUser(() => this.touch());
    const end = onUser(() => { this.interacting = false; this.touch(); });
    const zoomed = onUser(() => {
      // A deliberate zoom becomes the new tracking zoom: stable until changed again.
      this.trackingZoom = this.map.getZoom();
      this.interacting = false;
      this.touch();
    });

    // Pointer down/up. MapLibre's easeTo/jumpTo reset every gesture handler, so any
    // camera call between a press and the first drag movement kills the drag.
    // Hold off from the moment of the press; a click that never becomes a gesture
    // releases at once instead of costing a five-second pause.
    const press = onUser(() => {
      this.pressed = true;
      this.pressedAt = this.now();
      this.gesture = false;
    });
    const release = onUser((event) => {
      const touches = event.originalEvent.touches;
      if (touches && touches.length > 0) return; // another finger is still down
      this.pressed = false;
      if (this.gesture) this.touch();
    });
    ['mousedown', 'touchstart'].forEach((type) => this.listen(type, press));
    ['mouseup', 'touchend', 'touchcancel'].forEach((type) => this.listen(type, release));
    // Wheel zoom has no press; pause before its first frame is processed.
    this.listen('wheel', keep);

    INTERACTION_START.forEach((type) => this.listen(type, start));
    INTERACTION_CONTINUE.forEach((type) => this.listen(type, keep));
    INTERACTION_END.forEach((type) => this.listen(type, type === 'zoomend' ? zoomed : end));
    // Inertia after a drag finishes with a moveend that still carries the user event.
    this.listen('moveend', keep);
    // When one of our own eases ends the vehicle has kept gliding: re-centre it.
    this.listen('moveend', (event) => {
      if (!event || !event.originalEvent) this.frame();
    });
  }

  detach() {
    this.listeners.forEach(([type, handler]) => this.map.off(type, handler));
    this.listeners = [];
    this.clearTimers();
  }

  listen(type, handler) {
    this.map.on(type, handler);
    this.listeners.push([type, handler]);
  }

  clearTimers() {
    if (this.resumeTimer != null) this.clearTimer(this.resumeTimer);
    if (this.moveTimer != null) this.clearTimer(this.moveTimer);
    if (this.settleTimer != null) this.clearTimer(this.settleTimer);
    this.resumeTimer = null;
    this.moveTimer = null;
    this.settleTimer = null;
  }

  // --------------------------------------------------------------- settings

  configure({ followEnabled, trackingZoom } = {}) {
    if (typeof followEnabled === 'boolean') this.followEnabled = followEnabled;
    if (typeof trackingZoom === 'number' && Number.isFinite(trackingZoom)) this.trackingZoom = trackingZoom;
  }

  // -------------------------------------------------------------- selection

  /**
   * A vehicle was (re)selected. Following starts immediately and any manual-pan
   * pause from the previous vehicle is dropped.
   */
  select(deviceId, position, { focus = true } = {}) {
    this.clearTimers();
    this.interacting = false;
    this.pressed = false;
    this.gesture = false;
    this.lastInteractionAt = null;
    this.filter.reset();
    this.lastMovedFix = null;
    this.lastMoveAt = 0;
    this.selectedId = deviceId ?? null;
    this.latest = null;
    this.needsFocus = false;

    if (this.selectedId == null) return;

    if (!focus) {
      // Re-adopting the existing selection (e.g. the map re-mounted after a
      // base-map switch): keep following from here, but do not move the camera.
      if (isValidFollowFix(position) && this.filter.evaluate(position, this.now()).action === 'accept') {
        this.latest = position;
        this.lastMovedFix = position;
      }
      return;
    }

    this.needsFocus = true;
    if (isValidFollowFix(position)) this.update(position);
  }

  // ---------------------------------------------------------------- updates

  /** A position for the selected vehicle arrived. */
  update(position) {
    if (this.selectedId == null) return;
    // With following switched off the camera still focuses once on selection.
    if (!this.followEnabled && !this.needsFocus) return;
    if (!isValidFollowFix(position)) return;
    if (sameFix(position, this.latest)) return;

    const verdict = this.filter.evaluate(position, this.now());
    if (verdict.action !== 'accept') return;

    this.latest = position;
    if (this.isPaused()) return;
    // Gliding vehicles are followed frame by frame (see frame()); only the
    // initial focus needs an explicit move.
    if (this.smoothFor(this.selectedId) && !this.needsFocus) {
      this.scheduleSettle();
      return;
    }
    this.scheduleMove();
  }

  /**
   * A fix the marker shows instantly (after a long silence, or a confirmed
   * relocation) starts no glide, so the frame loop never runs for it. Re-centre
   * once, after the marker has been drawn for this fix. A normal glide starts
   * from where the icon already is, so this is then a no-op.
   */
  scheduleSettle() {
    if (this.settleTimer != null) return;
    this.settleTimer = this.setTimer(() => {
      this.settleTimer = null;
      this.frame();
    }, 0);
  }

  /** True when the icon for `deviceId` is drawn by the motion tracker. */
  smoothFor(deviceId) {
    return Boolean(this.motion && this.motion.isEnabled() && this.motion.targetOf(deviceId));
  }

  /** Where the vehicle is drawn right now (its glide position), as [lng, lat]. */
  drawnCoordinates(position) {
    if (this.smoothFor(position.deviceId ?? this.selectedId)) {
      const drawn = this.motion.positionAt(position.deviceId ?? this.selectedId);
      if (drawn) return drawn;
    }
    return [position.longitude, position.latitude];
  }

  /**
   * Keep the drawn vehicle at the centre of the safe area. Called every
   * animation frame while a glide is running, and once when an ease ends.
   */
  frame() {
    if (this.framing || this.selectedId == null || !this.latest) return;
    if (!this.followEnabled || this.needsFocus || this.isPaused()) return;
    if (!this.smoothFor(this.selectedId)) return;
    if (typeof this.map.isEasing === 'function' && this.map.isEasing()) return;

    // A held outlier is drawn by the marker but must not drag the camera.
    const target = this.motion.targetOf(this.selectedId);
    if (target[0] !== this.latest.longitude || target[1] !== this.latest.latitude) return;

    const drawn = this.motion.positionAt(this.selectedId);
    if (!drawn) return;

    const safe = this.getSafeArea();
    const point = this.map.project(drawn);
    if (Math.hypot(point.x - safe.center.x, point.y - safe.center.y) < FRAME_LOCK_MIN_PX) return;

    this.framing = true;
    try {
      this.map.easeTo({ center: drawn, offset: [safe.offset.x, safe.offset.y], duration: 0 });
    } finally {
      this.framing = false;
    }
    this.lastMovedFix = this.latest;
  }

  isPaused() {
    if (this.interacting) return true;
    if (this.pressed && this.now() - this.pressedAt < PRESS_STALE_MS) return true;
    return this.lastInteractionAt != null
      && this.now() - this.lastInteractionAt < RESUME_AFTER_MS;
  }

  // ---------------------------------------------------------------- pausing

  touch() {
    this.lastInteractionAt = this.now();
    if (this.moveTimer != null) {
      this.clearTimer(this.moveTimer);
      this.moveTimer = null;
    }
    this.armResume(RESUME_AFTER_MS);
  }

  armResume(delay) {
    if (this.resumeTimer != null) this.clearTimer(this.resumeTimer);
    this.resumeTimer = this.setTimer(() => {
      this.resumeTimer = null;
      if (this.interacting) {
        this.armResume(RESUME_AFTER_MS);
        return;
      }
      const remaining = RESUME_AFTER_MS - (this.now() - (this.lastInteractionAt ?? 0));
      if (remaining > 0) {
        this.armResume(remaining);
        return;
      }
      this.lastInteractionAt = null;
      if (this.selectedId != null && this.latest && (this.followEnabled || this.needsFocus)) {
        this.performMove(this.latest, { reason: 'resume' });
      }
    }, delay);
  }

  // ----------------------------------------------------------------- moving

  /** Coalesce bursts (e.g. a tracker flushing a backlog) into one move: latest wins. */
  scheduleMove() {
    if (this.moveTimer != null) return;
    const wait = Math.max(0, this.lastMoveAt + MIN_MOVE_INTERVAL_MS - this.now());
    if (wait === 0) {
      this.performMove(this.latest, { reason: this.needsFocus ? 'select' : 'follow' });
      return;
    }
    this.moveTimer = this.setTimer(() => {
      this.moveTimer = null;
      if (this.latest && !this.isPaused()) {
        this.performMove(this.latest, { reason: this.needsFocus ? 'select' : 'follow' });
      }
    }, wait);
  }

  performMove(position, { reason }) {
    if (!position) return;
    if (reason !== 'resume' && sameFix(position, this.lastMovedFix) && !this.needsFocus) return;

    const safe = this.getSafeArea();
    const target = this.drawnCoordinates(position);
    const point = this.map.project(target);
    const dx = point.x - safe.center.x;
    const dy = point.y - safe.center.y;
    const distance = Math.hypot(dx, dy);

    const focusing = this.needsFocus || reason === 'select';
    const currentZoom = this.map.getZoom();
    const zoomChanges = focusing && Math.abs(currentZoom - this.trackingZoom) > 0.01;

    if (!zoomChanges && distance < MIN_MOVE_PX) {
      this.lastMovedFix = position;
      this.needsFocus = false;
      return;
    }

    const viewport = Math.max(safe.width, safe.height);
    const far = distance > viewport * JUMP_VIEWPORT_FRACTION;

    const options = {
      center: target,
      offset: [safe.offset.x, safe.offset.y],
      easing: easeOutQuad,
    };
    if (zoomChanges) options.zoom = this.trackingZoom;

    if (far) {
      options.duration = 0;
    } else if (focusing) {
      options.duration = SELECT_DURATION_MS;
    } else {
      const cadence = this.lastMoveAt ? this.now() - this.lastMoveAt : MAX_PAN_DURATION_MS;
      options.duration = Math.min(MAX_PAN_DURATION_MS, Math.max(MIN_PAN_DURATION_MS, cadence));
    }

    this.map.easeTo(options);
    this.lastMoveAt = this.now();
    this.lastMovedFix = position;
    this.needsFocus = false;
  }
}
