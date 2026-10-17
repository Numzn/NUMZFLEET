import circle from '@turf/circle';
import { geometryToArea } from '../../map/core/mapUtil.js';

/** tc_geofences.name is VARCHAR(128) (Traccar schema changelog-4.0). */
export const GEOFENCE_NAME_MAX = 128;

/**
 * What to call a saved geofence in the list: its shape, unless it was created
 * from a catalogue boundary or as a radius zone (then say so, honestly).
 */
export const geofenceKind = (area, attributes) => {
  if (attributes?.numzZone === 'radius') return 'Radius zone';
  if (attributes?.numzLevel) {
    const level = String(attributes.numzLevel);
    return `${level[0].toUpperCase()}${level.slice(1)} boundary`;
  }
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
export const boundaryToGeofenceBody = (name, geometry, place = null) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Enter a name for the geofence.');
  if (trimmed.length > GEOFENCE_NAME_MAX) {
    throw new Error(`Name must be ${GEOFENCE_NAME_MAX} characters or fewer.`);
  }
  if (geometry?.type !== 'Polygon' || !Array.isArray(geometry.coordinates?.[0])) {
    throw new Error('A boundary polygon is required.');
  }
  // Record where the outline came from so it can always be labelled for what it is.
  const attributes = place
    ? { numzSource: String(place.id || place.source || ''), numzLevel: String(place.level || '') }
    : {};
  return { name: trimmed, area: geometryToArea(geometry), attributes };
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

export const RADIUS_MIN_M = 100;
export const RADIUS_MAX_M = 50000;

/** Radius choices offered in the UI (metres). */
export const RADIUS_PRESETS_M = [500, 1000, 2000, 5000, 10000];

const validRadius = (radiusM) => Number.isFinite(radiusM) && radiusM >= RADIUS_MIN_M && radiusM <= RADIUS_MAX_M;
const validCenter = (c) => Array.isArray(c) && c.length === 2
  && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;

export const formatRadius = (radiusM) => (radiusM >= 1000 ? `${radiusM / 1000} km` : `${radiusM} m`);

/**
 * A radius-based operational zone as a REAL Traccar CIRCLE (`CIRCLE (lat lon, metres)`, the format Traccar
 * evaluates natively for ENTER/EXIT). Labelled as a radius zone, never as the place's boundary.
 * center is [lon, lat].
 */
export const radiusZoneBody = (name, center, radiusM, placeName = '') => {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Enter a name for the geofence.');
  if (trimmed.length > GEOFENCE_NAME_MAX) throw new Error(`Name must be ${GEOFENCE_NAME_MAX} characters or fewer.`);
  if (!validCenter(center)) throw new Error('A valid location is required for a radius zone.');
  const radius = Number(radiusM);
  if (!validRadius(radius)) {
    throw new Error(`Radius must be between ${RADIUS_MIN_M} m and ${RADIUS_MAX_M / 1000} km.`);
  }
  return {
    name: trimmed,
    area: `CIRCLE (${center[1].toFixed(6)} ${center[0].toFixed(6)}, ${Math.round(radius)})`,
    attributes: { numzZone: 'radius', numzRadiusM: String(Math.round(radius)), ...(placeName ? { numzPlace: String(placeName) } : {}) },
  };
};

/** Polygon used to PREVIEW a radius zone on the map (Traccar itself stores and tests the true circle). */
export const radiusPreviewGeometry = (center, radiusM) => {
  if (!validCenter(center) || !validRadius(Number(radiusM))) return null;
  return circle(center, Number(radiusM), { steps: 96, units: 'meters' }).geometry;
};

export const defaultRadiusName = (placeName, radiusM) => `${placeName} — ${formatRadius(radiusM)} radius zone`.slice(0, GEOFENCE_NAME_MAX);
