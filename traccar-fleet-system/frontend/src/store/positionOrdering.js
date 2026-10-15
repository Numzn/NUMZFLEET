/** A stored fix this far in the future is a bad device clock, not "newer". */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const fixTimeMs = (position) => {
  const parsed = Date.parse(position?.fixTime);
  return Number.isFinite(parsed) ? parsed : NaN;
};

/**
 * Whether `incoming` is an older fix than the one already held for the device.
 *
 * Trackers flush backlogs and, after a reconnect, a superseded connection can
 * still deliver frames late. Applying those as "the latest position" would drag
 * the marker backwards. Equal or newer fixes are always applied, so a normal
 * stream and an in-order backlog replay behave exactly as before.
 *
 * A held fix far in the future (device clock wrong) never blocks newer data.
 */
export const isOlderFix = (existing, incoming, nowMs = Date.now()) => {
  if (!existing || !incoming) return false;
  const held = fixTimeMs(existing);
  const next = fixTimeMs(incoming);
  if (!Number.isFinite(held) || !Number.isFinite(next)) return false;
  if (held > nowMs + FUTURE_TOLERANCE_MS) return false;
  return next < held;
};

export default isOlderFix;
