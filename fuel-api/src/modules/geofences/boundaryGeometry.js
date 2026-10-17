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
export const MAX_RING_AREA_KM2 = 50000;
const MIN_RING_POINTS = 4; // closed triangle

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
export const simplifyRingToFit = (ring, maxChars = MAX_AREA_CHARS) => {
  let pts = openRing(ring).map(round6);
  let tol = 1e-6; // degrees, ~0.1 m
  const close = (r) => [...r, r[0]];
  let guard = 0;
  while (wktLength(close(pts)) > maxChars && guard < 60) {
    const next = douglasPeucker([...pts, pts[0]], tol * tol).slice(0, -1);
    if (next.length >= 3) pts = next;
    tol *= 1.5;
    guard += 1;
  }
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
  let droppedHoles = 0;
  polygons.forEach((poly) => {
    if (!Array.isArray(poly) || !poly.length) return;
    const [outer, ...holes] = poly;
    if (!validateRing(outer)) return;
    const area = ringAreaKm2(outer);
    if (area <= 0) return;
    candidates.push({ outer, area, holes: holes.length });
  });
  if (!candidates.length) return { ok: false, reason: 'invalid_geometry' };

  candidates.sort((a, b) => b.area - a.area);
  const [best] = candidates;
  droppedHoles = best.holes;
  const droppedParts = candidates.length - 1;
  if (best.area > MAX_RING_AREA_KM2) return { ok: false, reason: 'too_large' };

  const before = openRing(best.outer).length;
  const ring = simplifyRingToFit(best.outer);
  if (wktLength(ring) > MAX_AREA_CHARS || ringAreaKm2(ring) <= 0) {
    return { ok: false, reason: 'cannot_simplify' };
  }
  return {
    ok: true,
    geometry: { type: 'Polygon', coordinates: [ring] },
    areaKm2: Math.round(ringAreaKm2(ring) * 10) / 10,
    vertices: ring.length - 1,
    notes: {
      droppedParts,
      droppedHoles,
      simplified: ring.length - 1 < before,
    },
  };
};
