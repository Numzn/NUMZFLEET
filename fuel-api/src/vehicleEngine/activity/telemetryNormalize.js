const ONLINE_EVENT_TYPES = new Set(['deviceonline', 'devicemoving', 'devicestopped']);
const OFFLINE_EVENT_TYPES = new Set(['deviceoffline', 'deviceunknown']);

/**
 * Normalizes a Traccar forwarded event payload into the shape
 * vehicleStateEngine.evaluateStateTransition expects. Returns null for
 * anything malformed rather than throwing — ingestion must never 500 back to
 * Traccar over a payload shape it doesn't recognize.
 *
 * Traccar's event.forward.url sends event fields (id, deviceId, type,
 * eventTime) nested under an "event" key, alongside sibling "position" and
 * "device" objects — i.e. { event: {...}, position: {...}, device: {...} } —
 * confirmed against a live forwarded payload, not just the docs. Also accept
 * a flat shape (event fields at the root) since that's what the reconciliation
 * poller (traccarEventQuery.js, reading tc_events directly) constructs.
 */
export function normalizeTraccarEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const eventObj = raw.event && typeof raw.event === 'object' ? raw.event : raw;

  const eventId = Number(eventObj.id);
  const deviceId = Number(eventObj.deviceId ?? raw.device?.id);
  const type = String(eventObj.type || '').trim().toLowerCase();
  const eventTime = eventObj.eventTime ? new Date(eventObj.eventTime) : null;

  if (!Number.isFinite(eventId) || !Number.isFinite(deviceId) || !type) return null;
  if (!eventTime || Number.isNaN(eventTime.getTime())) return null;

  const position = raw.position || null;
  const device = raw.device || null;

  let deviceStatus = device?.status ?? null;
  if (!deviceStatus) {
    if (ONLINE_EVENT_TYPES.has(type)) deviceStatus = 'online';
    else if (OFFLINE_EVENT_TYPES.has(type)) deviceStatus = 'offline';
  }

  const deviceLastUpdate = device?.lastUpdate ?? position?.fixTime ?? eventObj.eventTime;

  let positionSpeed = position?.speed != null ? Number(position.speed) : null;
  if (positionSpeed == null || !Number.isFinite(positionSpeed)) {
    // No embedded position (e.g. the reconciliation poller, which only reads
    // tc_events, not tc_positions) — fall back to what the event type itself
    // implies, since devicemoving/devicestopped are speed transitions by definition.
    if (type === 'devicestopped') positionSpeed = 0;
    else if (type === 'devicemoving') positionSpeed = 1;
  }

  return {
    eventId,
    deviceId,
    eventType: type,
    eventTime,
    deviceStatus,
    deviceLastUpdate,
    positionSpeed,
  };
}
