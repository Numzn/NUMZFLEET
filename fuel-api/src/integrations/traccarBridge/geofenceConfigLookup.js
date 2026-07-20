import { getTraccarGeofence } from '../../config/traccar.js';
import { parseTraccarAttributesRaw, normalizeBool } from '../../utils/fleetConfigUtils.js';

/**
 * Whether a geofence has been flagged restricted/high-priority via its
 * `numzRestricted` custom attribute — set through Traccar's own geofence
 * editor (same convention as `numzFleetConfig` on devices), not a
 * NUMZFLEET-side management UI.
 *
 * Fails open (returns false) on any lookup error or missing geofence, so a
 * DB hiccup degrades to today's existing "warning" behavior rather than
 * silently escalating (or missing) an alert.
 * @param {number} geofenceId
 */
export async function isRestrictedGeofence(geofenceId) {
  if (geofenceId == null) return false;
  try {
    const geofence = await getTraccarGeofence(Number(geofenceId));
    if (!geofence) return false;
    const attrs = parseTraccarAttributesRaw(geofence.attributes);
    return normalizeBool(attrs.numzRestricted, false);
  } catch {
    return false;
  }
}
