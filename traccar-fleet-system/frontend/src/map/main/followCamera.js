/**
 * Pure helpers for following the selected vehicle with the map camera.
 *
 * Everything here is DOM- and MapLibre-free so it can be unit-tested under
 * `node --test`. The imperative side lives in FollowCameraController.js.
 */

/** Tracking zoom used when following starts. A user zoom adjustment replaces it. */
export const DEFAULT_TRACKING_ZOOM = 16;

/** Following resumes this long after the last manual map interaction. */
export const RESUME_AFTER_MS = 5000;

/**
 * A pressed pointer blocks camera moves (MapLibre resets gesture handlers on
 * every camera call, which would kill a drag before it starts). If the matching
 * release is never seen the press is ignored after this long.
 */
export const PRESS_STALE_MS = 15_000;

/** Camera moves are coalesced to at most one per this interval (latest wins). */
export const MIN_MOVE_INTERVAL_MS = 120;

/** Bounds for the pan duration; the actual duration follows the update cadence. */
export const MIN_PAN_DURATION_MS = 250;
export const MAX_PAN_DURATION_MS = 900;

/** Ease used when a vehicle is (re)selected and the camera has to travel to it. */
export const SELECT_DURATION_MS = 800;

/** Movements smaller than this on screen are GPS jitter, not worth animating. */
export const MIN_MOVE_PX = 2;

/** A target farther than this many viewport lengths away is jumped to, not panned. */
export const JUMP_VIEWPORT_FRACTION = 1;

/** Clearance between the vehicle and the edges of the usable map area. */
export const SAFE_MARGIN_PX = 24;
export const CONTROL_GAP_PX = 12;

/**
 * A fix that moves farther than SPIKE_MIN_DISTANCE_M at an implied speed above
 * SPIKE_SPEED_MPS (~324 km/h) is held back until a second fix confirms it.
 */
export const SPIKE_MIN_DISTANCE_M = 1000;
export const SPIKE_SPEED_MPS = 90;
export const SPIKE_CONFIRM_RADIUS_M = 500;

/** A last-accepted fix this far in the future is a bad device clock, not "newer". */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const EARTH_RADIUS_M = 6371008.8;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres. */
export const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
};

/**
 * Whether a position may steer the camera. The marker is drawn regardless; this
 * only stops garbage coordinates from flinging the viewport.
 */
export const isValidFollowFix = (position) => {
  if (!position) return false;
  const { latitude, longitude } = position;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  // "Null island": trackers without a fix commonly report exactly 0,0.
  if (Math.abs(latitude) < 1e-5 && Math.abs(longitude) < 1e-5) return false;
  if (position.valid === false) return false;
  return true;
};

const fixTimeMs = (position) => {
  const parsed = Date.parse(position?.fixTime);
  return Number.isFinite(parsed) ? parsed : NaN;
};

/**
 * Stateful gatekeeper deciding which fixes the camera follows.
 *
 * `evaluate` returns one of:
 *   { action: 'accept', jump } – follow it (`jump` = confirmed large relocation)
 *   { action: 'hold' }         – suspicious outlier, wait for confirmation
 *   { action: 'ignore' }       – invalid or older than what we already followed
 */
export const createFixFilter = () => {
  let last = null;
  let pending = null;

  const remember = (position, t) => ({
    latitude: position.latitude, longitude: position.longitude, t,
  });

  return {
    reset() {
      last = null;
      pending = null;
    },

    evaluate(position, nowMs = Date.now()) {
      if (!isValidFollowFix(position)) return { action: 'ignore', reason: 'invalid' };

      const t = fixTimeMs(position);

      if (
        last && Number.isFinite(t) && Number.isFinite(last.t)
        && t < last.t && last.t <= nowMs + FUTURE_TOLERANCE_MS
      ) {
        return { action: 'ignore', reason: 'older' };
      }

      if (!last) {
        last = remember(position, t);
        return { action: 'accept', jump: false, reason: 'first' };
      }

      if (pending) {
        const toPending = haversineMeters(
          pending.latitude, pending.longitude, position.latitude, position.longitude,
        );
        if (toPending <= SPIKE_CONFIRM_RADIUS_M) {
          // Two consecutive fixes agree on the new place: it is a real relocation.
          last = remember(position, t);
          pending = null;
          return { action: 'accept', jump: true, reason: 'confirmed' };
        }
        // Not confirmed: fall through and judge this fix against the last good one.
        pending = null;
      }

      const distance = haversineMeters(
        last.latitude, last.longitude, position.latitude, position.longitude,
      );
      const dtSeconds = Number.isFinite(t) && Number.isFinite(last.t)
        ? Math.max(1, (t - last.t) / 1000)
        : 1;

      if (distance > SPIKE_MIN_DISTANCE_M && distance / dtSeconds > SPIKE_SPEED_MPS) {
        pending = remember(position, t);
        return { action: 'hold', reason: 'spike' };
      }

      last = remember(position, t);
      return { action: 'accept', jump: false, reason: 'normal' };
    },
  };
};

/**
 * The part of the map the vehicle should stay inside: the canvas minus the
 * MapLibre padding (sidebar, top chrome, bottom sheet), minus any map control
 * stacks, minus a margin. `controls` are rectangles in container pixels.
 *
 * Returns the rectangle plus `offset`: where its centre sits relative to the
 * padded viewport centre, which is what MapLibre's `easeTo({ offset })` wants.
 */
export const computeSafeArea = ({
  width,
  height,
  padding = {},
  controls = [],
  extra = {},
  margin = SAFE_MARGIN_PX,
  gap = CONTROL_GAP_PX,
}) => {
  const pad = {
    left: padding.left || 0, right: padding.right || 0, top: padding.top || 0, bottom: padding.bottom || 0,
  };

  const paddedCenter = {
    x: pad.left + (width - pad.left - pad.right) / 2,
    y: pad.top + (height - pad.top - pad.bottom) / 2,
  };

  let left = pad.left + margin + (extra.left || 0);
  let right = width - pad.right - margin - (extra.right || 0);
  let top = pad.top + margin + (extra.top || 0);
  let bottom = height - pad.bottom - margin - (extra.bottom || 0);

  controls.forEach((control) => {
    if ((control.left + control.right) / 2 > width / 2) {
      right = Math.min(right, control.left - gap);
    } else {
      left = Math.max(left, control.right + gap);
    }
  });

  // A tiny or inverted area (huge sheet on a small phone) is worse than none:
  // fall back to the padded viewport so the vehicle still lands somewhere sane.
  if (right - left < 80 || bottom - top < 80) {
    left = pad.left;
    right = width - pad.right;
    top = pad.top;
    bottom = height - pad.bottom;
  }

  const center = { x: (left + right) / 2, y: (top + bottom) / 2 };

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    center,
    offset: { x: center.x - paddedCenter.x, y: center.y - paddedCenter.y },
  };
};
