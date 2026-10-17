import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGeoBoundariesRows, buildOsmRows, representativePoint, pointInGeometry, findProvince,
} from './catalogueBuild.js';

const sq = (x, y, d) => [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]];
const poly = (...rings) => ({ type: 'Polygon', coordinates: rings });
const feat = (shapeName, shapeID, geometry) => ({ type: 'Feature', properties: { shapeName, shapeID }, geometry });
const META = (type) => ({
  boundaryID: `ZMB-${type}-1`, boundaryYearRepresented: '2020', buildDate: 'Dec 12, 2023',
  boundaryLicense: 'Creative Commons Attribution 4.0 (CC BY 4.0)', boundarySource: 'GRID3', gjDownloadURL: `https://example.test/${type}.geojson`,
});

describe('geometry helpers', () => {
  it('representativePoint lies inside a concave L-shaped outline where the centroid does not', () => {
    const L = poly([[0, 0], [10, 0], [10, 1], [1, 1], [1, 10], [0, 10], [0, 0]]);
    const p = representativePoint(L);
    assert.equal(pointInGeometry(p, L), true);
  });

  it('pointInGeometry respects holes and MultiPolygon parts', () => {
    const donut = poly(sq(0, 0, 10), sq(4, 4, 2));
    assert.equal(pointInGeometry([1, 1], donut), true);
    assert.equal(pointInGeometry([5, 5], donut), false);
    const multi = { type: 'MultiPolygon', coordinates: [[sq(0, 0, 1)], [sq(5, 5, 1)]] };
    assert.equal(pointInGeometry([5.5, 5.5], multi), true);
    assert.equal(pointInGeometry([3, 3], multi), false);
  });
});

describe('geoBoundaries rows', () => {
  const adm1 = { features: [feat('East', 'p1', poly(sq(30, -15, 2))), feat('West', 'p2', poly(sq(22, -15, 2)))] };
  const adm2 = { features: [feat('Alpha', 'd1', poly(sq(30.5, -14.5, 0.5))), feat('Beta', 'd2', poly(sq(22.5, -14.5, 0.5))), feat('Bad', 'd3', poly([[30, -15], [30.2, -14.8], [30.2, -15], [30, -14.8], [30, -15]]))] };
  const built = buildGeoBoundariesRows({ adm1, adm2, meta: { ADM1: META('ADM1'), ADM2: META('ADM2') }, aliases: { Alpha: ['Alphaville', 'alpha'] } });

  it('assigns each district to the province containing it, and labels levels', () => {
    const by = (n) => built.rows.find((r) => r.name === n);
    assert.equal(by('Alpha').province, 'East');
    assert.equal(by('Beta').province, 'West');
    assert.equal(by('Alpha').level, 'district');
    assert.equal(by('East').level, 'province');
    assert.equal(by('East').province, 'East');
  });

  it('carries source, licence, attribution and a Polygon with validation status', () => {
    const r = built.rows.find((x) => x.name === 'Alpha');
    assert.equal(r.source, 'geoboundaries');
    assert.equal(r.sourceId, 'd1');
    assert.match(r.license, /CC BY 4.0/);
    assert.match(r.attribution, /geoBoundaries/);
    assert.equal(r.geometryType, 'Polygon');
    assert.equal(r.validationStatus, 'valid');
    assert.equal(r.geometry.type, 'Polygon');
  });

  it('alternative spellings are stored normalised, without duplicating the main name', () => {
    const r = built.rows.find((x) => x.name === 'Alpha');
    assert.deepEqual(r.altNames, ['Alphaville']);
    assert.deepEqual(r.altNorms, ['alphaville']);
  });

  it('an invalid (bow-tie) source polygon is skipped and reported, never stored', () => {
    assert.ok(!built.rows.some((r) => r.name === 'Bad'));
    assert.deepEqual(built.skipped.map((s) => [s.name, s.reason]), [['Bad', 'self_intersecting']]);
  });
});

describe('OSM rows', () => {
  const provinces = [{ name: 'East', geometry: poly(sq(30, -15, 2)) }];
  const town = (name, id, geometry, extra = {}) => ({ type: 'Feature', properties: { name, osm_type: 'relation', osm_id: id, place: 'town', validity: 'valid', ...extra }, geometry });
  const node = (name, id, lon, lat, place = 'city') => ({ type: 'Feature', properties: { name, osm_type: 'node', osm_id: id, place }, geometry: { type: 'Point', coordinates: [lon, lat] } });
  const out = buildOsmRows({
    osm: { features: [
      town('Polytown', 1, poly(sq(30.2, -14.8, 0.1))),
      node('Polytown', 11, 30.25, -14.75, 'town'),
      node('Pinville', 2, 30.5, -14.5),
      { type: 'Feature', properties: { name: 'Some District', osm_type: 'relation', osm_id: 3, boundary: 'administrative', admin_level: '6' }, geometry: poly(sq(30, -15, 1)) },
      node('Nowhere', 4, 10, 10),
    ] },
    provinces, version: 'zambia-test.osm.pbf', sourceUrl: 'https://example.test/z.pbf',
  });

  it('keeps a town that has a polygon as a polygon and does not also list its point', () => {
    const rows = out.rows.filter((r) => r.name === 'Polytown');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].geometryType, 'Polygon');
    assert.equal(rows[0].level, 'town');
  });

  it('a town with only a pin stays a location: no polygon is invented', () => {
    const r = out.rows.find((x) => x.name === 'Pinville');
    assert.equal(r.geometryType, 'Point');
    assert.equal(r.validationStatus, 'location_only');
    assert.equal(r.geometry.type, 'Point');
    assert.equal(r.areaKm2, null);
    assert.equal(r.level, 'city');
    assert.equal(r.province, 'East');
  });

  it('records ODbL licence/attribution; does not import OSM admin districts (geoBoundaries is the authority)', () => {
    out.rows.forEach((r) => {
      assert.equal(r.license, 'ODbL 1.0');
      assert.match(r.attribution, /OpenStreetMap contributors/);
    });
    assert.ok(!out.rows.some((r) => r.name === 'Some District'));
  });

  it('a point outside every province has no province rather than a guessed one', () => {
    assert.equal(out.rows.find((r) => r.name === 'Nowhere').province, null);
    assert.equal(findProvince([10, 10], provinces), null);
  });
});
