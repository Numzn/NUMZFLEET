import { normalizeBoundaryGeometry, ringAreaKm2 } from './boundaryGeometry.js';
import { normalizeName } from './placeCatalogue.js';

/**
 * Pure builders that turn raw source GeoJSON into catalogue rows
 * (src/scripts/buildPlaceCatalogue.js does the file I/O). Every polygon goes
 * through the SAME normalizeBoundaryGeometry the search/save path uses, so
 * what is stored is exactly what will later be previewed and saved.
 */

const GEOBOUNDARIES_ATTRIBUTION = 'Boundaries © geoBoundaries (William & Mary geoLab), CC BY 4.0 — upstream data: ';
const OSM_ATTRIBUTION = '© OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright';

const pointInRing = (pt, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Source-geometry polygons (GeoJSON Polygon|MultiPolygon) as [outerRing, ...] lists. */
const polygonsOf = (geometry) => {
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  return [];
};

export const pointInGeometry = (pt, geometry) => polygonsOf(geometry).some((poly) => {
  if (!poly?.length || !pointInRing(pt, poly[0])) return false;
  return !poly.slice(1).some((hole) => pointInRing(pt, hole));
});

/** A point guaranteed to lie inside the largest part (a centroid can fall outside a concave outline). */
export const representativePoint = (geometry) => {
  const polys = polygonsOf(geometry).filter((p) => p?.[0]?.length >= 4);
  if (!polys.length) return null;
  const outer = polys.map((p) => p[0]).sort((a, b) => ringAreaKm2(b) - ringAreaKm2(a))[0];
  const ys = outer.map((p) => p[1]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let best = null;
  for (let k = 1; k < 8; k += 1) {
    const y = minY + ((maxY - minY) * k) / 8;
    const xs = [];
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i, i += 1) {
      const [xi, yi] = outer[i];
      const [xj, yj] = outer[j];
      if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    for (let m = 0; m + 1 < xs.length; m += 2) {
      const width = xs[m + 1] - xs[m];
      if (!best || width > best.width) best = { width, pt: [(xs[m] + xs[m + 1]) / 2, y] };
    }
  }
  return best ? best.pt : outer[0];
};

export const findProvince = (pt, provinces) => {
  if (!pt) return null;
  const hit = provinces.find((p) => pointInGeometry(pt, p.geometry));
  return hit ? hit.name : null;
};

const dedupeNames = (names, main) => {
  const seen = new Set([normalizeName(main)]);
  const out = [];
  names.filter(Boolean).forEach((n) => {
    const norm = normalizeName(n);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(n);
    }
  });
  return out;
};

const polygonRow = (base, geometry, validity) => {
  const norm = normalizeBoundaryGeometry(geometry);
  if (!norm.ok) return { skipped: norm.reason };
  const ring = norm.geometry.coordinates[0];
  const c = representativePoint(norm.geometry) || ring[0];
  return {
    row: {
      ...base,
      geometryType: 'Polygon',
      validationStatus: validity === 'repaired' ? 'repaired' : 'valid',
      geometry: norm.geometry,
      centroidLon: Math.round(c[0] * 1e6) / 1e6,
      centroidLat: Math.round(c[1] * 1e6) / 1e6,
      areaKm2: norm.areaKm2,
      vertices: norm.vertices,
      originalVertices: norm.originalVertices,
      originalAreaKm2: norm.originalAreaKm2,
      maxDeviationM: norm.maxDeviationM,
      notes: norm.notes,
    },
  };
};

/**
 * @param {{adm1:object, adm2:object, meta:{ADM1:object, ADM2:object}, aliases?:object}} input
 * @returns {{rows:object[], skipped:object[]}}
 */
export const buildGeoBoundariesRows = ({ adm1, adm2, meta, aliases = {} }) => {
  const rows = [];
  const skipped = [];
  const provinces = adm1.features.map((f) => ({ name: f.properties.shapeName, geometry: f.geometry }));

  const make = (level, feature, m, extra = {}) => {
    const name = feature.properties.shapeName;
    const base = {
      source: 'geoboundaries',
      sourceId: feature.properties.shapeID,
      sourceVersion: `${m.boundaryID} (${m.boundaryYearRepresented}, build ${m.buildDate})`,
      sourceUrl: m.gjDownloadURL,
      license: m.boundaryLicense,
      attribution: `${GEOBOUNDARIES_ATTRIBUTION}${m.boundarySource}`,
      name,
      nameNorm: normalizeName(name),
      altNames: dedupeNames(aliases[name] || [], name),
      level,
      ...extra,
    };
    base.altNorms = base.altNames.map(normalizeName);
    const out = polygonRow(base, feature.geometry, 'valid');
    if (out.row) rows.push(out.row);
    else skipped.push({ source: 'geoboundaries', sourceId: base.sourceId, name, reason: out.skipped });
  };

  adm1.features.forEach((f) => make('province', f, meta.ADM1, { province: f.properties.shapeName }));
  adm2.features.forEach((f) => {
    const province = findProvince(representativePoint(f.geometry), provinces);
    make('district', f, meta.ADM2, { province });
  });
  return { rows, skipped, provinces };
};

const OSM_LEVEL = (props) => {
  if (props.place === 'city') return 'city';
  if (props.place === 'town') return 'town';
  if (props.place === 'suburb') return 'suburb';
  return null;
};

/**
 * OSM town/city polygons and town/city points. A town that only exists as a
 * point stays a point (validationStatus 'location_only'): it is never turned
 * into a polygon here.
 */
export const buildOsmRows = ({ osm, provinces, version, sourceUrl }) => {
  const rows = [];
  const skipped = [];
  const seenPoly = new Set();
  const features = osm?.features || [];
  const baseFor = (p, level, province) => {
    const alts = dedupeNames([p.name_en, p.alt_name, p.old_name].flatMap((v) => (v ? String(v).split(';') : [])), p.name);
    return {
      source: 'osm',
      sourceId: `${p.osm_type}/${p.osm_id}`,
      sourceVersion: version,
      sourceUrl,
      license: 'ODbL 1.0',
      attribution: OSM_ATTRIBUTION,
      name: p.name,
      nameNorm: normalizeName(p.name),
      altNames: alts,
      altNorms: alts.map(normalizeName),
      level,
      province,
    };
  };

  // polygons first, so a town point that has a polygon is not listed as "location only" too
  features.filter((f) => f.geometry?.type !== 'Point').forEach((f) => {
    const p = f.properties;
    const level = OSM_LEVEL(p);
    if (!level) return; // admin-level polygons are not imported: geoBoundaries is the district authority
    const province = findProvince(representativePoint(f.geometry), provinces);
    const out = polygonRow(baseFor(p, level, province), f.geometry, p.validity);
    if (out.row) {
      rows.push(out.row);
      seenPoly.add(`${out.row.nameNorm}|${level}`);
    } else skipped.push({ source: 'osm', sourceId: `${p.osm_type}/${p.osm_id}`, name: p.name, reason: out.skipped });
  });

  features.filter((f) => f.geometry?.type === 'Point').forEach((f) => {
    const p = f.properties;
    const level = OSM_LEVEL(p);
    if (!level) return;
    const [lon, lat] = f.geometry.coordinates;
    if (seenPoly.has(`${normalizeName(p.name)}|${level}`)) return;
    if (level === 'suburb') return; // suburbs are imported only where OSM has an outline
    const province = findProvince([lon, lat], provinces);
    rows.push({
      ...baseFor(p, level, province),
      geometryType: 'Point',
      validationStatus: 'location_only',
      geometry: { type: 'Point', coordinates: [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] },
      centroidLon: Math.round(lon * 1e6) / 1e6,
      centroidLat: Math.round(lat * 1e6) / 1e6,
      areaKm2: null,
      vertices: null,
      originalVertices: null,
      originalAreaKm2: null,
      maxDeviationM: null,
      notes: {},
    });
  });
  return { rows, skipped };
};

export const sortRows = (rows) => [...rows].sort((a, b) => (
  a.source.localeCompare(b.source) || a.sourceId.localeCompare(b.sourceId)
));
