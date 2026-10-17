import { geometryToArea } from '../../map/core/mapUtil.js';

/** tc_geofences.name is VARCHAR(128) (Traccar schema changelog-4.0). */
export const GEOFENCE_NAME_MAX = 128;

/** Traccar WKT kinds we can render in the list. */
export const geofenceKind = (area) => {
  const a = String(area || '').trimStart().toUpperCase();
  if (a.startsWith('CIRCLE')) return 'Circle';
  if (a.startsWith('POLYGON')) return 'Polygon';
  if (a.startsWith('LINESTRING')) return 'Line';
  return 'Other';
};

/** Case-insensitive name/description filter; blank query returns everything. */
export const filterGeofences = (items, query) => {
  const list = Array.isArray(items) ? items : Object.values(items || {});
  const q = String(query || '').trim().toLowerCase();
  const sorted = [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  if (!q) return sorted;
  return sorted.filter((g) => `${g.name || ''} ${g.description || ''}`.toLowerCase().includes(q));
};

/**
 * Body for POST /api/geofences (Traccar). `geometry` is a GeoJSON Polygon in
 * lon,lat order from the boundary-search API; geometryToArea is the same
 * converter manual drawing uses, so Traccar gets lat-lon WKT either way.
 * Throws rather than posting anything that is not an area.
 */
export const boundaryToGeofenceBody = (name, geometry) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Enter a name for the geofence.');
  if (trimmed.length > GEOFENCE_NAME_MAX) {
    throw new Error(`Name must be ${GEOFENCE_NAME_MAX} characters or fewer.`);
  }
  if (geometry?.type !== 'Polygon' || !Array.isArray(geometry.coordinates?.[0])) {
    throw new Error('A boundary polygon is required.');
  }
  return { name: trimmed, area: geometryToArea(geometry), attributes: {} };
};

/**
 * Traccar device id of a fleet vehicle (GET /api/vehicles shape: the active
 * device assignment, with the merged device as a fallback), or null when the
 * vehicle has no tracker.
 */
export const vehicleDeviceId = (vehicle) => {
  const raw = vehicle?.assignment?.deviceId ?? vehicle?.device?.id;
  const id = Number(raw);
  return raw != null && Number.isFinite(id) && id > 0 ? id : null;
};

/** Vehicles that can be linked: Traccar permissions attach geofences to devices. */
export const splitAssignableVehicles = (vehicles) => {
  const list = Array.isArray(vehicles) ? vehicles : [];
  const assignable = list.filter((v) => vehicleDeviceId(v) != null);
  return { assignable, unassignable: list.length - assignable.length };
};

/** One permission body per vehicle device (same shape LinkField posts). */
export const permissionBodies = (geofenceId, vehicles) => (vehicles || [])
  .map((v) => vehicleDeviceId(v))
  .filter((deviceId) => deviceId != null)
  .map((deviceId) => ({ deviceId, geofenceId }));
