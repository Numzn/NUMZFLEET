const GEOFENCE_ALARM_TYPES = new Set(['geofenceenter', 'geofenceexit', 'geofence']);

function normalizeType(type, attributes = {}) {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'geofenceenter') return 'geofenceEnter';
  if (t === 'geofenceexit') return 'geofenceExit';
  if (t === 'deviceoverspeed') return 'overspeed';
  if (t === 'ignitionon') return 'ignitionOn';
  if (t === 'ignitionoff') return 'ignitionOff';
  if (t === 'devicemoving') return 'deviceMoving';
  if (t === 'devicestopped') return 'deviceStopped';
  if (t === 'alarm') {
    const alarm = String(attributes?.alarm || '').toLowerCase();
    if (alarm === 'geofenceenter') return 'geofenceEnter';
    if (alarm === 'geofenceexit') return 'geofenceExit';
    if (GEOFENCE_ALARM_TYPES.has(alarm)) return 'geofenceEnter';
  }
  return type?.trim?.() || 'unknown';
}

export function labelForEventType(type, attributes = {}) {
  const resolved = normalizeType(type, attributes);
  const lower = String(resolved).toLowerCase();

  if (lower === 'geofenceenter') return 'Entered geofence';
  if (lower === 'geofenceexit') return 'Exited geofence';
  if (lower === 'overspeed') return 'Overspeed detected';
  if (lower === 'ignitionon') return 'Ignition on';
  if (lower === 'ignitionoff') return 'Ignition off';
  if (lower === 'maintenance') return 'Maintenance alert';
  if (lower === 'fueldrop') return 'Fuel drop detected';
  if (lower === 'alarm') {
    const alarm = String(attributes?.alarm || '').trim();
    return alarm ? `Alarm: ${alarm}` : 'Alarm';
  }

  return resolved;
}

export { normalizeType };
