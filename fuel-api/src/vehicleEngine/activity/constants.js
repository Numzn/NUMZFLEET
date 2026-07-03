/** Stops shorter than this are collapsed into the same journey narrative. */
export const BRIEF_STOP_MS = 3 * 60 * 1000;

/** Window for detecting trip fragmentation anomalies. */
export const FRAGMENTATION_WINDOW_MS = 30 * 60 * 1000;

/** Minimum trips in a window to flag fragmentation. */
export const FRAGMENTATION_TRIP_COUNT = 3;

/** Telemetry event types hidden from the operational activity feed. */
export const MOTION_TELEMETRY_TYPES = new Set([
  'devicemoving',
  'devicestopped',
  'deviceonline',
  'deviceoffline',
]);

/** Event types surfaced as operational activities (not collapsed). */
export const OPERATIONAL_EVENT_TYPES = new Set([
  'geofenceenter',
  'geofenceexit',
  'deviceoverspeed',
  'overspeed',
  'alarm',
  'maintenance',
  'fueldrop',
  'ignitionon',
  'ignitionoff',
]);
