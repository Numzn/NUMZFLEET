const CRITICAL_TYPES = new Set(['alarm', 'sos', 'fault', 'panic', 'emergency']);
const WARNING_TYPES = new Set(['overspeed', 'geofenceEnter', 'geofenceExit', 'maintenance', 'fuelDrop']);

/** Traccar geofence event types — used for display filtering (Traccar still records events). */
export const GEOFENCE_EVENT_TYPES = new Set(['geofenceEnter', 'geofenceExit']);

const GEOFENCE_ALARM_TYPES = new Set(['geofenceenter', 'geofenceexit', 'geofence']);

export function resolveEventType(type, attributes) {
  const t = String(type || '');
  if (GEOFENCE_EVENT_TYPES.has(t)) return t;
  if (t === 'alarm') {
    const alarm = String(attributes?.alarm || '').toLowerCase();
    if (alarm === 'geofenceenter') return 'geofenceEnter';
    if (alarm === 'geofenceexit') return 'geofenceExit';
  }
  return t;
}

export function isGeofenceEventType(type, attributes) {
  const t = String(type || '');
  if (GEOFENCE_EVENT_TYPES.has(t)) return true;
  if (t === 'alarm') {
    return GEOFENCE_ALARM_TYPES.has(String(attributes?.alarm || '').toLowerCase());
  }
  return false;
}

export function mapAlertSeverity(type, attributes) {
  const resolved = resolveEventType(type, attributes);
  const t = String(resolved || '').toLowerCase();
  if (CRITICAL_TYPES.has(t) || t.includes('critical') || t.includes('sos')) return 'critical';
  if (t === 'alarm' && attributes?.alarm) {
    const alarm = String(attributes.alarm).toLowerCase();
    if (GEOFENCE_ALARM_TYPES.has(alarm)) return 'warning';
  }
  if (WARNING_TYPES.has(t) || t.includes('warning') || t.includes('overspeed')) return 'warning';
  if (t.includes('info') || t === 'textMessage') return 'info';
  return 'warning';
}

export function enrichAlerts(rawAlerts) {
  if (!rawAlerts?.length) return [];
  return rawAlerts.map((a) => ({
    ...a,
    type: resolveEventType(a.type, a.attributes),
    severity: mapAlertSeverity(a.type, a.attributes),
  }));
}
