const CRITICAL_TYPES = new Set(['alarm', 'sos', 'fault', 'panic', 'emergency']);
const WARNING_TYPES = new Set(['overspeed', 'geofenceEnter', 'geofenceExit', 'maintenance', 'fuelDrop']);

export function mapAlertSeverity(type) {
  const t = String(type || '').toLowerCase();
  if (CRITICAL_TYPES.has(t) || t.includes('critical') || t.includes('sos')) return 'critical';
  if (WARNING_TYPES.has(t) || t.includes('warning') || t.includes('overspeed')) return 'warning';
  if (t.includes('info') || t === 'textMessage') return 'info';
  return 'warning';
}

export function enrichAlerts(rawAlerts) {
  if (!rawAlerts?.length) return [];
  return rawAlerts.map((a) => ({
    ...a,
    severity: mapAlertSeverity(a.type),
  }));
}
