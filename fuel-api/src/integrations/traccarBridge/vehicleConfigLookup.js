import { getTraccarDevice } from '../../config/traccar.js';
import { parseTraccarAttributesRaw, parseDeviceFleetConfig } from '../../utils/fleetConfigUtils.js';

/**
 * Fleet config for geofence mute checks (stored on Traccar device attributes).
 * @param {number} deviceId
 */
export async function fetchFleetConfigByDeviceId(deviceId) {
  if (deviceId == null) return null;
  try {
    const device = await getTraccarDevice(Number(deviceId));
    if (!device) return null;
    const attrs = parseTraccarAttributesRaw(device.attributes);
    return parseDeviceFleetConfig(attrs);
  } catch {
    return null;
  }
}
