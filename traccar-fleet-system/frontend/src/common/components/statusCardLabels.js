/**
 * Label for a row in the position status card (shown on the Replay and Event pages, for a position at a point in
 * the past). A tracker's distance counter is evidence of what that device reported then; it is NOT the vehicle's
 * odometer (which fuel-api resolves from the vehicle's own baseline plus the accepted counter), so it must not
 * be labelled like one.
 */
const TRACKER_COUNTER_KEYS = new Set(['totalDistance', 'odometer']);

export const TRACKER_COUNTER_LABEL = 'Tracker distance counter';

export function positionRowLabel(key, localizedName) {
  if (TRACKER_COUNTER_KEYS.has(key)) return TRACKER_COUNTER_LABEL;
  return localizedName || key;
}
