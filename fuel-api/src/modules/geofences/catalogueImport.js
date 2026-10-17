import {
  wktLength, MAX_AREA_CHARS, isValidPosition, ringSelfIntersects,
} from './boundaryGeometry.js';
import { PLACE_LEVELS } from '../../models/PlaceBoundary.js';

/**
 * Re-checks a catalogue row before it may enter the database, independent of
 * how the catalogue file was produced (a hand-edited or stale file must not be
 * able to put an unusable boundary in front of fleet managers).
 * @returns {string|null} a reason it is rejected, or null when acceptable
 */
export const rowProblem = (row) => {
  if (!row?.source || !row?.sourceId || !row?.name) return 'missing_identity';
  if (!PLACE_LEVELS.includes(row.level)) return 'bad_level';
  if (!row.license || !row.attribution) return 'missing_licence';
  if (row.geometryType === 'Point') {
    if (row.validationStatus !== 'location_only') return 'point_not_location_only';
    return row.geometry?.type === 'Point' && isValidPosition(row.geometry.coordinates) ? null : 'bad_point';
  }
  if (row.geometryType !== 'Polygon' || row.geometry?.type !== 'Polygon') return 'not_polygon';
  if (row.validationStatus === 'location_only') return 'polygon_marked_location_only';
  const ring = row.geometry.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isValidPosition)) return 'bad_ring';
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return 'ring_not_closed';
  if (wktLength(ring) > MAX_AREA_CHARS) return 'too_long_for_traccar';
  if (ringSelfIntersects(ring)) return 'self_intersecting';
  return null;
};

const FIELDS = [
  'sourceVersion', 'sourceUrl', 'license', 'attribution', 'name', 'nameNorm', 'altNames', 'altNorms', 'level',
  'province', 'geometryType', 'validationStatus', 'geometry', 'centroidLon', 'centroidLat', 'areaKm2', 'vertices',
  'originalVertices', 'originalAreaKm2', 'maxDeviationM', 'notes',
];

// JSONB does not preserve object key order, so compare canonically or every row looks "changed".
const canonical = (v) => {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v ?? null;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/**
 * Idempotent load. Identity is (source, sourceId): running it twice creates
 * nothing new, changed rows are updated in place, and a place that vanished
 * from a source this file covers is DEACTIVATED (kept, searchable by nobody),
 * never deleted. It only ever touches the place catalogue table — geofences
 * live in Traccar and are never read or written here.
 *
 * @param {object[]} rows catalogue rows
 * @param {{ findAll:Function, create:Function, update:Function }} store thin wrapper over the model
 */
export const importCatalogue = async (rows, store, { dryRun = false } = {}) => {
  const summary = { created: 0, updated: 0, unchanged: 0, reactivated: 0, deactivated: 0, rejected: [] };
  const accepted = [];
  rows.forEach((row) => {
    const problem = rowProblem(row);
    if (problem) summary.rejected.push({ source: row.source, sourceId: row.sourceId, name: row.name, problem });
    else accepted.push(row);
  });

  const sources = [...new Set(accepted.map((r) => r.source))];
  const existing = await store.findAll(sources);
  const byKey = new Map(existing.map((r) => [`${r.source}|${r.sourceId}`, r]));
  const seen = new Set();

  for (const row of accepted) {
    const key = `${row.source}|${row.sourceId}`;
    if (seen.has(key)) {
      summary.rejected.push({ source: row.source, sourceId: row.sourceId, name: row.name, problem: 'duplicate_in_file' });
      continue;
    }
    seen.add(key);
    const current = byKey.get(key);
    if (!current) {
      summary.created += 1;
      if (!dryRun) await store.create({ ...row, isActive: true });
    } else {
      const changed = FIELDS.filter((f) => !same(current[f], row[f]));
      if (!changed.length && current.isActive) summary.unchanged += 1;
      else {
        if (!current.isActive) summary.reactivated += 1;
        if (changed.length) summary.updated += 1;
        if (!dryRun) await store.update(current, { ...Object.fromEntries(FIELDS.map((f) => [f, row[f]])), isActive: true });
      }
    }
  }

  for (const current of existing) {
    if (!current.isActive || seen.has(`${current.source}|${current.sourceId}`)) continue;
    summary.deactivated += 1;
    if (!dryRun) await store.update(current, { isActive: false });
  }
  return summary;
};
