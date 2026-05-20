import { getTraccarPool } from '../../config/traccar.js';
import { getManagerUserIds } from '../../services/userService.js';
import { fetchFleetConfigByDeviceId } from './vehicleConfigLookup.js';

function uniqIds(ids) {
  return [...new Set(ids.filter((x) => Number.isFinite(Number(x))).map((x) => Number(x)))];
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

  if (opts.respectGeofenceMute) {
    const fleetConfig = await fetchFleetConfigByDeviceId(deviceId);
    if (fleetConfig?.alerts?.geofence === false) {
      const isGeofence = opts.traccarType === 'geofenceEnter'
        || opts.traccarType === 'geofenceExit'
        || String(opts.attributes?.alarm || '').toLowerCase().includes('geofence');
      if (isGeofence) {
        return [];
      }
    }
  }

  return uniqIds([...managerIds, ...deviceUserIds]);
}
