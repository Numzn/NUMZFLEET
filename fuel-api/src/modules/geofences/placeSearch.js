import { searchBoundaries, BoundarySearchError } from './boundarySearchService.js';
import {
  parseQuery, rankPlaces, buildCatalogueResponse, normalizeName,
} from './placeCatalogue.js';

const MAX_CATALOGUE_RESULTS = 12;
const OSM_ATTRIBUTION = '© OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright';

// Live lookups also return roads, offices, monuments... only genuine places can anchor a zone.
const PLACE_LIKE = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'quarter', 'municipality', 'locality', 'isolated dwelling']);

const kindOfLiveLevel = (level) => {
  const l = String(level || '');
  if (l.startsWith('province')) return 'province';
  if (l === 'district' || l === 'region') return 'district';
  return 'town';
};

/** Live Nominatim result -> the same DTO shape the catalogue produces. */
const liveBoundaryDto = (r) => ({
  id: `nominatim:${r.id}`,
  source: 'nominatim',
  sourceLabel: 'OpenStreetMap (live lookup)',
  license: 'ODbL 1.0',
  attribution: OSM_ATTRIBUTION,
  name: r.name,
  level: r.level,
  levelLabel: r.level ? r.level[0].toUpperCase() + r.level.slice(1) : 'Area',
  kind: kindOfLiveLevel(r.level),
  province: null,
  verified: true,
  recommended: false,
  warning: kindOfLiveLevel(r.level) === 'town' ? null : 'This is a larger administrative area than a town.',
  displayName: r.displayName,
  center: null,
  geometry: r.geometry,
  areaKm2: r.areaKm2,
  vertices: r.vertices,
  originalVertices: r.originalVertices,
  maxDeviationM: r.maxDeviationM,
  notes: r.notes,
});

const liveLocationDto = (r) => ({
  id: `nominatim:${r.id}`,
  source: 'nominatim',
  sourceLabel: 'OpenStreetMap (live lookup)',
  license: 'ODbL 1.0',
  attribution: OSM_ATTRIBUTION,
  name: r.name,
  level: r.level,
  levelLabel: r.level ? r.level[0].toUpperCase() + r.level.slice(1) : 'Place',
  kind: kindOfLiveLevel(r.level),
  province: null,
  verified: false,
  recommended: false,
  warning: 'Location only — no verified boundary exists for this place.',
  displayName: r.displayName,
  center: r.center,
});

/** Compatibility keys older clients read (results / pointResults). */
const withLegacyKeys = (resp) => ({
  ...resp,
  results: resp.boundaries,
  pointResults: resp.locations,
  pointOnly: resp.locations.length,
});

/**
 * Catalogue first; live Nominatim only when the catalogue knows nothing by that
 * name (so a normal town search never touches the public service).
 *
 * @param {string} rawQuery
 * @param {{ repository:{listMetadata:Function,getGeometries:Function}, live?:Function }} deps
 */
export const searchPlaces = async (rawQuery, { repository, live = searchBoundaries } = {}) => {
  const parsed = parseQuery(rawQuery);
  if (normalizeName(rawQuery).length < 3) {
    throw new BoundarySearchError(400, 'query_too_short', 'Enter at least 3 characters.');
  }
  if (String(rawQuery).trim().length > 100) {
    throw new BoundarySearchError(400, 'query_too_long', 'Search text is too long.');
  }

  let rows = [];
  try {
    rows = await repository.listMetadata();
  } catch (e) {
    // e.g. migration not applied yet: degrade to the live lookup rather than failing the search.
    console.warn('[placeSearch] catalogue unavailable, using live lookup:', e?.message);
  }

  const ranked = rankPlaces(rows, parsed).slice(0, MAX_CATALOGUE_RESULTS);
  if (ranked.length) {
    const geometries = await repository.getGeometries(
      ranked.filter((r) => r.geometryType === 'Polygon').map((r) => r.id),
    );
    const withGeometry = ranked.map((r) => (geometries.has(r.id) ? { ...r, geometry: geometries.get(r.id) } : r))
      // a polygon row whose geometry is missing must not be offered as verified
      .filter((r) => r.geometryType !== 'Polygon' || geometries.has(r.id) || r.geometry);
    return withLegacyKeys({
      query: String(rawQuery).trim(),
      source: 'catalogue',
      cached: false,
      ...buildCatalogueResponse(withGeometry),
    });
  }

  const found = await live(rawQuery);
  const boundaries = found.results.map(liveBoundaryDto);
  const locations = (found.pointResults || []).filter((r) => PLACE_LIKE.has(String(r.level))).map(liveLocationDto);
  return withLegacyKeys({
    query: String(rawQuery).trim(),
    source: 'nominatim',
    cached: Boolean(found.cached),
    townBoundary: boundaries.some((b) => b.kind === 'town'),
    boundaries,
    locations,
    attribution: [OSM_ATTRIBUTION],
    notice: boundaries.length
      ? 'This place is not in the Zambian catalogue; these boundaries come from a live OpenStreetMap lookup.'
      : 'No verified boundary was found for this place. You can draw your own, or create a radius zone around a location.',
  });
};
