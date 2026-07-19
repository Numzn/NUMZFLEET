import { getTraccarPool } from '../../config/traccar.js';
import { getManagerUserIds } from '../../services/userService.js';
import { fetchFleetConfigByDeviceId } from './vehicleConfigLookup.js';

function uniqIds(ids) {
  return [...new Set(ids.filter((x) => Number.isFinite(Number(x))).map((x) => Number(x)))];
}

const GEOFENCE_TYPE_SET = new Set([
  'geofenceenter',
  'geofenceexit',
  'tracking.geofence.entered',
  'tracking.geofence.exited',
]);

/**
 * Robust geofence event detection across casing / source differences.
 * @param {string | null | undefined} traccarType
 * @param {object | null | undefined} attributes
 */
export function isGeofenceTrackingEvent(traccarType, attributes) {
  const type = String(traccarType || '').trim().toLowerCase();
  if (GEOFENCE_TYPE_SET.has(type)) return true;
  if (type.includes('geofence')) return true;
  const alarm = String(attributes?.alarm || '').trim().toLowerCase();
  return alarm.includes('geofence');
}

/**
 * Users linked to a Traccar device via tc_user_device.
 * @param {number} deviceId
 */
export async function getDeviceLinkedUserIds(deviceId) {
  if (deviceId == null) return [];
  try {
    const pool = getTraccarPool();
    const [rows] = await pool.execute(
      'SELECT userid FROM tc_user_device WHERE deviceid = ?',
      [Number(deviceId)],
    );
    return uniqIds(rows.map((r) => r.userid));
  } catch {
    return [];
  }
}

/**
 * Resolve notification audience for a tracking event on a device.
 * @param {number} deviceId
 * @param {{ respectGeofenceMute?: boolean, traccarType?: string, attributes?: object }} [opts]
 */
export async function resolveTrackingEventAudience(deviceId, opts = {}) {
  const managerIds = await getManagerUserIds();
  const deviceUserIds = await getDeviceLinkedUserIds(deviceId);
  const fleetConfig = await fetchFleetConfigByDeviceId(deviceId);

  if (opts.respectGeofenceMute && fleetConfig) {
    const type = String(opts.traccarType || '').toLowerCase();
    const alarm = String(opts.attributes?.alarm || '').toLowerCase();

    if (fleetConfig.alerts?.geofence === false && isGeofenceTrackingEvent(opts.traccarType, opts.attributes)) {
      return [];
    }
    if (fleetConfig.alerts?.speeding === false && (type.includes('overspeed') || type === 'deviceoverspeed')) {
      return [];
    }
    if (fleetConfig.alerts?.lowFuel === false && (type.includes('fuel') || alarm.includes('fuel'))) {
      return [];
    }
    if (fleetConfig.alerts?.engineCut === false && (alarm.includes('powercut') || alarm.includes('ignition'))) {
      return [];
    }
  }

  return uniqIds([...managerIds, ...deviceUserIds]);
}
