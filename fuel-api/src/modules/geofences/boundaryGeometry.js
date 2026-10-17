/**
 * Pure geometry helpers for "Search Boundary" geofence creation.
 *
 * Traccar's geofence `area` column only understands POLYGON / CIRCLE /
 * LINESTRING WKT (no MULTIPOLYGON, no holes) and is a bounded VARCHAR, so a raw
 * administrative boundary cannot be stored as-is. These helpers reduce a
 * GeoJSON Polygon/MultiPolygon (lon,lat order) to ONE simple outer ring that
 * fits, and report exactly what was dropped so the UI can tell the user.
 */

export const MAX_AREA_CHARS = 4000; // Traccar tc_geofences.area is VARCHAR(4096)
export const MAX_RING_AREA_KM2 = 200000; // largest Zambian province is ~147,000 km²; a country is not a geofence
const MIN_RING_POINTS = 4; // closed triangle
const SELF_CHECK_MAX_POINTS = 800; // above this the O(n^2) check is skipped mid-loop

const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);

export const isValidPosition = (p) => Array.isArray(p)
  && p.length >= 2
  && isFiniteNum(p[0]) && isFiniteNum(p[1])
  && p[0] >= -180 && p[0] <= 180
  && p[1] >= -90 && p[1] <= 90;

const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Open ring (no repeated closing point), consecutive duplicates removed. */
const openRing = (ring) => {
  const out = [];
  ring.forEach((p) => {
    const pt = [p[0], p[1]];
    if (!out.length || !samePoint(out[out.length - 1], pt)) out.push(pt);
  });
  if (out.length > 1 && samePoint(out[0], out[out.length - 1])) out.pop();
  return out;
};

/** Shoelace area in km² using an equirectangular projection (good enough for sizing). */
export const ringAreaKm2 = (ring) => {
  const pts = openRing(ring);
  if (pts.length < 3) return 0;
  const lat0 = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110.57;
  let sum = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += (x1 * kx) * (y2 * ky) - (x2 * kx) * (y1 * ky);
  }
  return Math.abs(sum) / 2;
};

const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const segmentsCross = (a, b, c, d) => {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
};

/**
 * True when two non-adjacent edges of the (open or closed) ring properly cross
 * each other: a bow-tie, which Traccar's ray-casting containment mis-evaluates.
 * O(n^2): call it on rings of a few hundred points, not raw source geometry.
 */
export const ringSelfIntersects = (ring) => {
  const pts = openRing(ring);
  const n = pts.length;
  for (let i = 0; i < n; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue; // adjacent through the closing edge
      if (segmentsCross(a, b, pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
};

const perpDistSq = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return (p[0] - (a[0] + t * dx)) ** 2 + (p[1] - (a[1] + t * dy)) ** 2;
};

const douglasPeucker = (pts, tolSq) => {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i += 1) {
      const d = perpDistSq(pts[i], pts[s], pts[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx !== -1 && maxD > tolSq) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};

/** Length of the Traccar WKT ("POLYGON ((lat lon, ...))") for a lon,lat ring. */
export const wktLength = (ring) => {
  const body = ring.map((p) => `${p[1].toFixed(6)} ${p[0].toFixed(6)}`).join(', ');
  return `POLYGON ((${body}))`.length;
};

const round6 = (p) => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6];

/**
 * Simplify an open ring until its WKT fits MAX_AREA_CHARS. Returns a CLOSED
 * ring. Never drops below a triangle.
 */
export const simplifyRingToFit = (ring, maxChars = MAX_AREA_CHARS, stats = {}) => {
  let pts = openRing(ring).map(round6);
  let tol = 1e-6; // degrees, ~0.1 m
  let used = 0;
  const close = (r) => [...r, r[0]];
  let guard = 0;
  while (wktLength(close(pts)) > maxChars && guard < 80) {
    const next = douglasPeucker([...pts, pts[0]], tol * tol).slice(0, -1);
    // Never accept a simplification that folds the outline over itself.
    const safe = next.length >= 3 && (next.length > SELF_CHECK_MAX_POINTS || !ringSelfIntersects(next));
    if (safe) {
      pts = next;
      used = tol;
    }
    tol *= 1.5;
    guard += 1;
  }
  stats.toleranceDeg = used;
  return close(pts);
};

const validateRing = (ring) => Array.isArray(ring)
  && ring.length >= MIN_RING_POINTS
  && ring.every(isValidPosition)
  && openRing(ring).length >= 3;

/**
 * @param {{type:string, coordinates:any}} geometry GeoJSON, lon,lat order
 * @returns {{ok:true, geometry:{type:'Polygon',coordinates:number[][][]}, areaKm2:number,
 *   vertices:number, notes:{droppedParts:number, droppedHoles:number, simplified:boolean}}
 *   | {ok:false, reason:string}}
 */
export const normalizeBoundaryGeometry = (geometry) => {
  if (!geometry || typeof geometry !== 'object') return { ok: false, reason: 'no_geometry' };

  let polygons;
  if (geometry.type === 'Polygon') polygons = [geometry.coordinates];
  else if (geometry.type === 'MultiPolygon') polygons = geometry.coordinates;
  else return { ok: false, reason: 'not_an_area' }; // Point, LineString, ...

  if (!Array.isArray(polygons)) return { ok: false, reason: 'invalid_geometry' };

  const candidates = [];
  let sawSelfIntersecting = false;
  let droppedHoles = 0;
  polygons.forEach((poly) => {
    if (!Array.isArray(poly) || !poly.length) return;
    const [outer, ...holes] = poly;
    if (!validateRing(outer)) return;
    if (outer.length <= SELF_CHECK_MAX_POINTS && ringSelfIntersects(outer)) {
      sawSelfIntersecting = true;
      return;
    }
    const area = ringAreaKm2(outer);
    if (area <= 0) return;
    candidates.push({ outer, area, holes: holes.length });
  });
  if (!candidates.length) return { ok: false, reason: sawSelfIntersecting ? 'self_intersecting' : 'invalid_geometry' };

  candidates.sort((a, b) => b.area - a.area);
  const [best] = candidates;
  droppedHoles = best.holes;
  const droppedParts = candidates.length - 1;
  const totalArea = candidates.reduce((sum, c) => sum + c.area, 0);
  const droppedAreaPct = totalArea > 0 ? Math.round(((totalArea - best.area) / totalArea) * 1000) / 10 : 0;
  if (best.area > MAX_RING_AREA_KM2) return { ok: false, reason: 'too_large' };

  const before = openRing(best.outer).length;
  const stats = {};
  const ring = simplifyRingToFit(best.outer, MAX_AREA_CHARS, stats);
  if (wktLength(ring) > MAX_AREA_CHARS || ringAreaKm2(ring) <= 0) {
    return { ok: false, reason: 'cannot_simplify' };
  }
  // The source outline itself may be invalid (bow-tie); never save that.
  if (ringSelfIntersects(ring)) return { ok: false, reason: 'self_intersecting' };
  return {
    ok: true,
    geometry: { type: 'Polygon', coordinates: [ring] },
    areaKm2: Math.round(ringAreaKm2(ring) * 10) / 10,
    vertices: ring.length - 1,
    originalVertices: before,
    originalAreaKm2: Math.round(best.area * 10) / 10,
    // Upper bound on how far any discarded vertex lay from the saved outline.
    maxDeviationM: Math.round((stats.toleranceDeg || 0) * 111320),
    notes: {
      droppedParts,
      droppedHoles,
      droppedAreaPct,
      simplified: ring.length - 1 < before,
    },
  };
};
