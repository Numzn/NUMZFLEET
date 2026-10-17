/**
 * Pure matching/ranking over the Zambian place catalogue (place_boundaries rows).
 * No database, no network: the repository hands rows in, DTOs come out, so the
 * ranking rules are testable against real imported fixtures.
 *
 * Ranking principle: the user asked for a PLACE, so the most specific verified
 * boundary comes first (town/city/municipality), then the district, then the
 * province — each clearly labelled — and a larger area is never promoted over a
 * smaller one just because it happens to have a polygon.
 */

export const normalizeName = (raw) => String(raw ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/['’`]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const LEVEL_WORDS = {
  province: 'province',
  district: 'district',
  municipality: 'municipality',
  municipal: 'municipality',
  city: 'city',
  town: 'town',
};

/** "Lusaka district" -> { text: 'lusaka', hint: 'district' }; a bare name has no hint. */
export const parseQuery = (raw) => {
  const words = normalizeName(raw).split(' ').filter(Boolean);
  let hint = null;
  const kept = [];
  words.forEach((w) => {
    if (LEVEL_WORDS[w] && words.length > 1) hint = hint || LEVEL_WORDS[w];
    else if (w !== 'council' && w !== 'of') kept.push(w);
    else if (words.length === 1) kept.push(w);
  });
  return { text: kept.join(' '), hint };
};

export const LEVEL_LABELS = {
  province: 'Province',
  district: 'District',
  municipality: 'Municipality',
  city: 'City',
  town: 'Town',
  suburb: 'Suburb',
};

/** town-like levels are what a fleet manager means by "the town". */
export const levelKind = (level) => (level === 'province' ? 'province' : level === 'district' ? 'district' : 'town');

// Lower rank = more specific = listed first.
const KIND_RANK = { town: 0, district: 1, province: 2 };

const LEVEL_WARNINGS = {
  district: 'District boundary — it covers the whole district, which is larger than the town itself.',
  province: 'Province boundary — a very large area, much bigger than the town.',
};

const ATTRIBUTION_SHORT = { geoboundaries: 'geoBoundaries', osm: 'OpenStreetMap', nominatim: 'OpenStreetMap' };

/** How well a catalogue row's names match the parsed query: 3 exact, 2 prefix, 1 word-contains, 0 no. */
export const matchQuality = (row, text) => {
  if (!text || text.length < 2) return 0;
  const names = [row.nameNorm, ...(row.altNorms || [])].filter(Boolean);
  if (names.some((n) => n === text)) return 3;
  if (text.length >= 3 && names.some((n) => n.startsWith(text))) return 2;
  if (text.length >= 4 && names.some((n) => n.split(' ').includes(text))) return 1;
  return 0;
};

const isPolygon = (row) => row.geometryType === 'Polygon' && row.validationStatus !== 'location_only';

/**
 * @param {object[]} rows place_boundaries metadata (geometry optional)
 * @param {{text:string,hint:string|null}} parsed
 * @returns {object[]} matching rows, best-first, each with `_quality`
 */
export const rankPlaces = (rows, parsed) => {
  const matched = [];
  (rows || []).forEach((row) => {
    if (row.isActive === false) return;
    const q = matchQuality(row, parsed.text);
    if (q > 0) matched.push({ row, q });
  });
  // Only exact matches count when any exist: "Kabwe" must not drag in "Kabwe Rural"-style prefixes first.
  const bestQ = matched.reduce((m, x) => Math.max(m, x.q), 0);
  const kept = matched.filter((x) => x.q === bestQ || x.q >= 3);
  const rankOf = (row) => {
    const kind = levelKind(row.level);
    // An explicit "district"/"province" in the query lifts that level to the top.
    if (parsed.hint && (kind === levelKind(parsed.hint))) return -1;
    return KIND_RANK[kind];
  };
  kept.sort((a, b) => (
    rankOf(a.row) - rankOf(b.row)
    || b.q - a.q
    || (isPolygon(b.row) ? 1 : 0) - (isPolygon(a.row) ? 1 : 0)
    || String(a.row.name).localeCompare(String(b.row.name))
  ));
  return kept.map((x) => ({ ...x.row, _quality: x.q }));
};

/** Public DTO for one catalogue row (geometry attached when the row is a polygon). */
export const toPlaceDto = (row, { recommended = false } = {}) => {
  const kind = levelKind(row.level);
  const verified = isPolygon(row);
  const sourceLabel = ATTRIBUTION_SHORT[row.source] || row.source;
  return {
    id: `${row.source}:${row.sourceId}`,
    source: row.source,
    sourceLabel,
    license: row.license,
    attribution: row.attribution,
    name: row.name,
    level: row.level,
    levelLabel: LEVEL_LABELS[row.level] || row.level,
    kind,
    province: row.province || null,
    verified,
    recommended: Boolean(recommended && verified),
    warning: verified ? LEVEL_WARNINGS[kind] || null : 'Location only — no verified boundary exists for this place.',
    displayName: [row.name, row.province && row.province !== row.name ? `${row.province} Province` : null, 'Zambia'].filter(Boolean).join(', '),
    center: [row.centroidLon, row.centroidLat],
    ...(verified ? {
      geometry: row.geometry,
      areaKm2: row.areaKm2,
      vertices: row.vertices,
      originalVertices: row.originalVertices,
      maxDeviationM: row.maxDeviationM,
      notes: row.notes || {},
    } : {}),
  };
};

/**
 * Split ranked rows into the response sections.
 * `recommended` is only ever a TOWN-level polygon: when no town boundary exists
 * nothing is pre-selected, so the user consciously chooses a district or a
 * radius zone instead of being handed a larger area under the town's name.
 */
export const buildCatalogueResponse = (ranked) => {
  const townPolygon = ranked.find((r) => isPolygon(r) && levelKind(r.level) === 'town');
  const boundaries = ranked.filter(isPolygon).map((r) => toPlaceDto(r, { recommended: r === townPolygon }));
  const locations = ranked.filter((r) => !isPolygon(r)).map((r) => toPlaceDto(r));
  const attribution = [...new Set([...boundaries, ...locations].map((d) => d.attribution))];
  let notice = null;
  if (!townPolygon && (boundaries.length || locations.length)) {
    notice = locations.length
      ? 'No verified town boundary exists for this place — only a location. You can use the district boundary below, draw your own, or create a radius zone around the location.'
      : 'No verified town boundary was found. Use a district/province boundary below, or draw your own.';
  }
  return {
    townBoundary: Boolean(townPolygon),
    boundaries,
    locations,
    attribution,
    notice,
  };
};
