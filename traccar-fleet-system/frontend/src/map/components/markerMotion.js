import { haversineMeters, isValidFollowFix } from '../main/followCamera.js';

/**
 * Smooth, continuous marker movement between GPS fixes.
 *
 * Each device glides from where it is *drawn right now* to the newest fix, at
 * constant speed, over roughly the observed interval between updates. That makes
 * the icon travel continuously instead of hopping, without the old fixed-length
 * ease-out that restarted from a stale position on every update.
 *
 * It never shows a place the vehicle has not been: this is interpolation, not
 * prediction, so the icon trails the newest fix by about one update interval.
 * Implausible jumps, stale gaps and sub-metre GPS jitter are shown instantly.
 *
 * Pure and clock-injected (every method takes `now`), so it is unit-testable.
 */

/** Never glide faster than this (bursts of backlog fixes collapse to this). */
export const MIN_GLIDE_MS = 400;
/** Never glide slower than this, so a sparse tracker does not trail by minutes. */
export const MAX_GLIDE_MS = 8000;
/** Glide slightly longer than the cadence so steady updates never stop-and-go. */
export const GLIDE_HEADROOM = 1.1;
/** Weight of the previous cadence estimate (0 = trust only the latest gap). */
export const CADENCE_SMOOTHING = 0.5;
/** Movement below this is GPS jitter: show it, do not animate it. */
export const MIN_ANIMATED_DISTANCE_M = 0.75;
/** Faster than this between two fixes (~324 km/h) is a GPS jump, not driving. */
export const MAX_PLAUSIBLE_SPEED_MPS = 90;
/** After this long without an update the old motion estimate is meaningless. */
export const STALE_AFTER_MS = 120_000;
/**
 * Below this speed (knots, ~2 km/h) a tracker's course is noise or a stale zero,
 * so the vehicle keeps pointing the way it last travelled instead of snapping north.
 */
export const MIN_HEADING_SPEED_KN = 1;

const coordsAt = (entry, now) => {
  if (entry.duration <= 0) return entry.to;
  const t = (now - entry.start) / entry.duration;
  if (t >= 1) return entry.to;
  if (t <= 0) return entry.from;
  return [
    entry.from[0] + (entry.to[0] - entry.from[0]) * t,
    entry.from[1] + (entry.to[1] - entry.from[1]) * t,
  ];
};

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

const normalizeDegrees = (degrees) => ((degrees % 360) + 360) % 360;

/** Interpolate headings along the shortest arc (350 -> 10 passes through 0). */
const headingAtTime = (entry, now) => {
  if (entry.duration <= 0) return entry.headingTo;
  const t = (now - entry.start) / entry.duration;
  if (t >= 1) return entry.headingTo;
  if (t <= 0) return entry.headingFrom;
  const delta = ((entry.headingTo - entry.headingFrom + 540) % 360) - 180;
  return normalizeDegrees(entry.headingFrom + delta * t);
};

/** The heading a fix implies, or the last known one when the tracker has none. */
const headingFor = (position, previous) => {
  const course = Number(position.course);
  const speed = Number(position.speed);
  if (Number.isFinite(course) && speed > MIN_HEADING_SPEED_KN) return normalizeDegrees(course);
  if (previous != null) return previous;
  return Number.isFinite(course) ? normalizeDegrees(course) : 0;
};

export const createMotionTracker = ({ enabled = true } = {}) => {
  const entries = new Map();
  let on = enabled;

  const snap = (entry, to, now) => {
    entry.from = to;
    entry.to = to;
    entry.start = now;
    entry.duration = 0;
    entry.headingFrom = entry.headingTo;
  };

  return {
    setEnabled(value) {
      on = Boolean(value);
    },

    isEnabled() {
      return on;
    },

    /**
     * Register the newest fix for a device. Idempotent: pushing the same
     * position again (a re-render) changes nothing.
     */
    push(deviceId, position, now) {
      if (!position) return;
      const to = [position.longitude, position.latitude];
      const fixMs = Date.parse(position.fixTime);
      const entry = entries.get(deviceId);

      if (!entry) {
        const heading = headingFor(position, null);
        entries.set(deviceId, {
          from: to,
          to,
          start: now,
          duration: 0,
          lastArrival: now,
          cadence: null,
          positionId: position.id,
          fixMs,
          headingFrom: heading,
          headingTo: heading,
        });
        return;
      }

      if (entry.positionId === position.id && entry.to[0] === to[0] && entry.to[1] === to[1]) return;

      const gap = now - entry.lastArrival;
      const previousTarget = entry.to;
      const previousFixMs = entry.fixMs;
      const current = coordsAt(entry, now);
      const drawnHeading = headingAtTime(entry, now);
      const nextHeading = headingFor(position, entry.headingTo);

      entry.lastArrival = now;
      entry.positionId = position.id;
      entry.fixMs = fixMs;

      if (!on || !isValidFollowFix(position) || gap > STALE_AFTER_MS) {
        entry.headingTo = nextHeading;
        snap(entry, to, now);
        entry.cadence = null;
        return;
      }

      // Plausibility is judged on the real time between the two fixes, so a
      // backlog delivered in one burst is not mistaken for a teleport.
      const fixGapSeconds = Number.isFinite(fixMs) && Number.isFinite(previousFixMs) && fixMs > previousFixMs
        ? (fixMs - previousFixMs) / 1000
        : Math.max(gap / 1000, 1);
      const travelled = haversineMeters(previousTarget[1], previousTarget[0], to[1], to[0]);
      if (travelled / fixGapSeconds > MAX_PLAUSIBLE_SPEED_MPS) {
        entry.headingTo = nextHeading;
        snap(entry, to, now);
        entry.cadence = null;
        return;
      }

      const observed = Math.min(gap, MAX_GLIDE_MS);
      entry.cadence = entry.cadence == null
        ? observed
        : CADENCE_SMOOTHING * entry.cadence + (1 - CADENCE_SMOOTHING) * observed;

      const remaining = haversineMeters(current[1], current[0], to[1], to[0]);
      if (remaining < MIN_ANIMATED_DISTANCE_M) {
        entry.headingTo = nextHeading;
        snap(entry, to, now);
        return;
      }

      // Start from the position currently drawn, never from the previous fix:
      // the icon stays continuous when a new fix arrives mid-glide.
      entry.from = current;
      entry.to = to;
      entry.start = now;
      entry.duration = clamp(entry.cadence * GLIDE_HEADROOM, MIN_GLIDE_MS, MAX_GLIDE_MS);
      // Turn at the same pace as the glide, from the heading drawn right now.
      entry.headingFrom = drawnHeading;
      entry.headingTo = nextHeading;
    },

    /** Heading to draw at `now`, in degrees clockwise from north, or null if unknown. */
    headingAt(deviceId, now) {
      const entry = entries.get(deviceId);
      if (!entry) return null;
      return on ? headingAtTime(entry, now) : entry.headingTo;
    },

    /** Where the device should be drawn at `now` as [lng, lat], or null if unknown. */
    positionAt(deviceId, now) {
      const entry = entries.get(deviceId);
      if (!entry) return null;
      return on ? coordsAt(entry, now) : entry.to;
    },

    /** The newest fix the device is gliding towards, as [lng, lat]. */
    targetOf(deviceId) {
      return entries.get(deviceId)?.to ?? null;
    },

    isAnimating(now) {
      if (!on) return false;
      for (const entry of entries.values()) {
        if (entry.duration > 0 && now < entry.start + entry.duration) return true;
      }
      return false;
    },

    /** Forget devices that are no longer displayed. */
    prune(activeDeviceIds) {
      const keep = new Set(activeDeviceIds);
      [...entries.keys()].forEach((id) => {
        if (!keep.has(id)) entries.delete(id);
      });
    },

    clear() {
      entries.clear();
    },
  };
};

export default createMotionTracker;
