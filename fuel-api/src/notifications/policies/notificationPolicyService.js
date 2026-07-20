/**
 * Central notification behavior registry for Traccar tracking events.
 * Aligns with frontend vehicleAlertUtils for map/ops display (not bell ingest).
 */

const GEOFENCE_ALARM_TYPES = new Set(['geofenceenter', 'geofenceexit', 'geofence']);
const CRITICAL_TYPES = new Set(['panic', 'sos', 'emergency', 'fault']);
const WARNING_PERSIST_TYPES = new Set([
  'geofenceenter',
  'geofenceexit',
  'overspeed',
  'maintenance',
  'fueldrop',
]);
const SKIP_TYPES = new Set(['deviceonline', 'deviceoffline', 'devicemoving', 'devicestopped']);

function parseAttributes(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : {};
    } catch {
      return {};
    }
  }
  return {};
}

function resolveEventType(type, attributes) {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'geofenceenter' || t === 'tracking.geofence.entered') return 'geofenceEnter';
  if (t === 'geofenceexit' || t === 'tracking.geofence.exited') return 'geofenceExit';
  if (t === 'deviceoverspeed') return 'overspeed';
  if (t === 'alarm') {
    const alarm = String(attributes?.alarm || '').toLowerCase();
    if (alarm === 'geofenceenter') return 'geofenceEnter';
    if (alarm === 'geofenceexit') return 'geofenceExit';
    if (GEOFENCE_ALARM_TYPES.has(alarm)) return 'geofenceEnter';
  }
  return type?.trim?.() || 'unknown';
}

function isGeofenceEvent(resolvedType, attributes) {
  const t = String(resolvedType || '').toLowerCase();
  if (t === 'geofenceenter' || t === 'geofenceexit') return true;
  if (t === 'alarm') {
    return GEOFENCE_ALARM_TYPES.has(String(attributes?.alarm || '').toLowerCase());
  }
  return false;
}

/**
 * @param {{ type?: string, attributes?: object }} traccarEvent
 * @returns {{
 *   persist: boolean,
 *   ingestClient: boolean,
 *   severity: string,
 *   category: string,
 *   notificationType: string,
 *   resolvedType: string,
 *   channels: string[],
 * }}
 */
export function resolveTraccarTrackingPolicy(traccarEvent) {
  const attrs = parseAttributes(traccarEvent?.attributes);
  const resolvedType = resolveEventType(traccarEvent?.type, attrs);
  const rawLower = String(traccarEvent?.type || '').toLowerCase();
  const resolvedLower = String(resolvedType || '').toLowerCase();

  if (SKIP_TYPES.has(rawLower) || SKIP_TYPES.has(resolvedLower)) {
    return {
      persist: false,
      ingestClient: false,
      severity: 'info',
      category: 'tracking',
      notificationType: `traccar.${resolvedType}`,
      resolvedType,
      channels: [],
    };
  }

  if (isGeofenceEvent(resolvedType, attrs)) {
    const isExit = resolvedLower.includes('exit');
    return {
      persist: true,
      ingestClient: true,
      severity: 'warning',
      category: 'tracking',
      notificationType: isExit ? 'tracking.geofence.exited' : 'tracking.geofence.entered',
      resolvedType,
      channels: ['bell'],
    };
  }

  if (rawLower === 'alarm' || resolvedLower === 'alarm') {
    const alarm = String(attrs.alarm || '').toLowerCase();
    if (GEOFENCE_ALARM_TYPES.has(alarm)) {
      const isExit = alarm.includes('exit');
      return {
        persist: true,
        ingestClient: true,
        severity: 'warning',
        category: 'tracking',
        notificationType: isExit ? 'tracking.geofence.exited' : 'tracking.geofence.entered',
        resolvedType,
        channels: ['bell'],
      };
    }
    return {
      persist: true,
      ingestClient: true,
      severity: 'critical',
      category: 'security',
      notificationType: 'tracking.alarm',
      resolvedType,
      channels: ['bell', 'push', 'sms'],
    };
  }

  if (CRITICAL_TYPES.has(resolvedLower) || CRITICAL_TYPES.has(rawLower)) {
    return {
      persist: true,
      ingestClient: true,
      severity: 'critical',
      category: 'security',
      notificationType: `tracking.${resolvedLower}`,
      resolvedType,
      channels: ['bell', 'push', 'sms'],
    };
  }

  if (WARNING_PERSIST_TYPES.has(resolvedLower) || resolvedLower.includes('overspeed')) {
    return {
      persist: true,
      ingestClient: true,
      severity: 'warning',
      category: resolvedLower === 'maintenance' ? 'maintenance' : 'tracking',
      notificationType: `tracking.${resolvedLower}`,
      resolvedType,
      channels: ['bell'],
    };
  }

  return {
    persist: false,
    ingestClient: true,
    severity: 'info',
    category: 'tracking',
    notificationType: `traccar.${resolvedType}`,
    resolvedType,
    channels: [],
  };
}

/**
 * Build inbox title/message for a Traccar event row.
 * @param {{ type?: string, attributes?: object, deviceid?: number }} row
 * @param {{ resolvedType: string, notificationType: string }} policy
 */
export function buildTraccarNotificationCopy(row, policy) {
  const attrs = parseAttributes(row?.attributes);
  const msg = attrs.message != null ? String(attrs.message) : '';
  const resolved = policy.resolvedType || row?.type || 'Event';
  const title = resolved.replace(/([A-Z])/g, ' $1').trim() || policy.notificationType;
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    message: msg || title,
  };
}

/**
 * Stable dedup key aligned with frontend metadata.dedupKey
 */
export function traccarClientDedupKey(eventId, userId) {
  return `${userId}:traccar:${eventId}`;
}

export function traccarSharedDedupKey(eventId) {
  return `traccar:${eventId}`;
}
