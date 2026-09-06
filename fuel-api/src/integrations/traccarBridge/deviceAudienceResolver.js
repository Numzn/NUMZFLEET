import { getTraccarPool } from '../../config/traccar.js';
import { getManagerUserIds } from '../../services/userService.js';
import { fetchFleetConfigByDeviceId } from './vehicleConfigLookup.js';
import { CompanyDevice } from '../../models/index.js';

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
 * Owning company for a Traccar device, via company_devices — the same
 * mapping ensureDeviceInCompany()/getCompanyDeviceIds() maintain elsewhere.
 * Null when the device isn't (yet) linked to a company — legacy/unprovisioned
 * installs fall back to the instance-wide behavior this always had, rather
 * than silently dropping the notification.
 * @param {number} deviceId
 */
export async function resolveCompanyIdForDevice(deviceId) {
  if (deviceId == null) return null;
  try {
    const row = await CompanyDevice.findOne({
      where: { traccarDeviceId: Number(deviceId), isActive: true },
      attributes: ['companyId'],
    });
    return row?.companyId ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve notification audience for a tracking event on a device.
 * @param {number} deviceId
 * @param {{ respectGeofenceMute?: boolean, traccarType?: string, attributes?: object }} [opts]
 * @returns {Promise<{ userIds: number[], companyId: string|null }>}
 */
export async function resolveTrackingEventAudience(deviceId, opts = {}) {
  const companyId = await resolveCompanyIdForDevice(deviceId);
  const managerIds = await getManagerUserIds(companyId);
  const deviceUserIds = await getDeviceLinkedUserIds(deviceId);
  const fleetConfig = await fetchFleetConfigByDeviceId(deviceId);

  if (opts.respectGeofenceMute && fleetConfig) {
    const type = String(opts.traccarType || '').toLowerCase();
    const alarm = String(opts.attributes?.alarm || '').toLowerCase();

    if (fleetConfig.alerts?.geofence === false && isGeofenceTrackingEvent(opts.traccarType, opts.attributes)) {
      return { userIds: [], companyId };
    }
    if (fleetConfig.alerts?.speeding === false && (type.includes('overspeed') || type === 'deviceoverspeed')) {
      return { userIds: [], companyId };
    }
    if (fleetConfig.alerts?.lowFuel === false && (type.includes('fuel') || alarm.includes('fuel'))) {
      return { userIds: [], companyId };
    }
    if (fleetConfig.alerts?.engineCut === false && (alarm.includes('powercut') || alarm.includes('ignition'))) {
      return { userIds: [], companyId };
    }
  }

  return { userIds: uniqIds([...managerIds, ...deviceUserIds]), companyId };
}
