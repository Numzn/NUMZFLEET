import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { searchPlaces } from './placeSearch.js';
import { parseQuery, normalizeName, rankPlaces } from './placeCatalogue.js';
import { wktLength, MAX_AREA_CHARS, ringSelfIntersects } from './boundaryGeometry.js';

// REAL rows from the built catalogue (scripts/geo/make_fixture.mjs): geoBoundaries districts/provinces and,
// where OSM has them, town points/polygons — geometry untouched.
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/places.fixture.json', import.meta.url), 'utf8'));

const repoOf = (places) => ({
  listMetadata: async () => places.map(({ geometry, ...meta }) => meta),
  getGeometries: async (ids) => new Map(places.filter((p) => ids.includes(p.id)).map((p) => [p.id, p.geometry])),
});
const repository = repoOf(fixture.places);
const noLive = async () => { throw new Error('live lookup must not be used for a catalogued place'); };
const search = (q, extra = {}) => searchPlaces(q, { repository, live: noLive, ...extra });

describe('query parsing', () => {
  it('splits a level word from the place name', () => {
    assert.deepEqual(parseQuery('Lusaka District'), { text: 'lusaka', hint: 'district' });
    assert.deepEqual(parseQuery('Central Province'), { text: 'central', hint: 'province' });
    assert.deepEqual(parseQuery('Kabwe'), { text: 'kabwe', hint: null });
    assert.deepEqual(parseQuery('  Itezhi-Tezhi '), { text: 'itezhi tezhi', hint: null });
    assert.equal(normalizeName("Shiwang'Andu"), 'shiwangandu');
  });
});

describe('searching real catalogue data', () => {
  it('Chipata: the district is offered, clearly labelled, and nothing larger is pre-selected', async () => {
    const out = await search('Chipata');
    assert.equal(out.source, 'catalogue');
    const names = out.boundaries.map((b) => `${b.level}:${b.name}`);
    assert.ok(names.includes('district:Chipata'), names.join());
    assert.ok(!out.boundaries.some((b) => b.kind === 'province'), 'no unrelated province');
    const district = out.boundaries.find((b) => b.level === 'district');
    assert.match(district.warning, /larger than the town/);
    assert.equal(district.province, 'Eastern');
    assert.equal(district.verified, true);
    // OpenStreetMap has Chipata only as a point: no verified town boundary exists, and the response says so.
    assert.equal(out.townBoundary, false);
    assert.ok(out.boundaries.every((b) => !b.recommended), 'a district is never auto-recommended as the town');
    assert.match(out.notice, /No verified town boundary/);
    const loc = out.locations.find((l) => l.name === 'Chipata');
    assert.ok(loc, 'the town is offered as a location (basis for a radius zone)');
    assert.equal(loc.verified, false);
    assert.equal(loc.source, 'osm');
    assert.match(loc.warning, /no verified boundary/i);
    assert.ok(loc.center[0] > 32 && loc.center[0] < 33.5 && loc.center[1] > -14.5 && loc.center[1] < -13, 'real Chipata coordinates, lon/lat');
  });

  it('a suburb that OSM does have an outline for is a verified, recommended boundary (Kanyama)', async () => {
    const out = await search('Kanyama');
    assert.equal(out.townBoundary, true);
    const b = out.boundaries[0];
    assert.equal(b.level, 'suburb');
    assert.equal(b.recommended, true);
    assert.equal(b.source, 'osm');
    assert.equal(b.province, 'Lusaka');
    assert.match(b.attribution, /OpenStreetMap contributors/);
    assert.equal(out.notice, null);
  });

  it('a mining town with a real OSM town polygon returns it as the town boundary, ahead of the district', async () => {
    const out = await search('Kalumbila');
    const kinds = out.boundaries.map((x) => `${x.source}:${x.level}`);
    assert.equal(kinds[0], 'osm:town', kinds.join());
    assert.ok(kinds.includes('geoboundaries:district'));
    assert.equal(out.boundaries[0].recommended, true);
    assert.equal(out.boundaries.find((x) => x.level === 'district').recommended, false);
  });

  it('Lusaka: distinguishes district and province, smaller first', async () => {
    const out = await search('Lusaka');
    const kinds = out.boundaries.map((b) => b.kind);
    assert.ok(kinds.includes('district') && kinds.includes('province'));
    assert.ok(kinds.indexOf('district') < kinds.indexOf('province'), 'district before province');
    const prov = out.boundaries.find((b) => b.kind === 'province');
    const dist = out.boundaries.find((b) => b.kind === 'district');
    assert.ok(prov.areaKm2 > dist.areaKm2 * 10, 'province is far larger than the district');
  });

  it('"Lusaka province" lifts the province to the top, "Lusaka district" the district', async () => {
    assert.equal((await search('Lusaka province')).boundaries[0].kind, 'province');
    assert.equal((await search('Lusaka district')).boundaries[0].kind, 'district');
  });

  it('Kabwe and Livingstone return their own boundary, never an unrelated province', async () => {
    for (const [q, province] of [['Kabwe', 'Central'], ['Livingstone', 'Southern']]) {
      const out = await search(q);
      assert.ok(out.boundaries.length >= 1, q);
      out.boundaries.forEach((b) => {
        assert.equal(b.name, q, `${q}: unexpected ${b.level} ${b.name}`);
        assert.notEqual(b.kind, 'province');
      });
      assert.equal(out.boundaries.find((b) => b.level === 'district').province, province);
    }
  });

  it('historic/alternative names find the same place', async () => {
    assert.equal((await search('Fort Jameson')).boundaries[0].name, 'Chipata');
    assert.equal((await search('Broken Hill')).boundaries[0].name, 'Kabwe');
  });

  it('every returned polygon is exactly what can be saved to Traccar', async () => {
    const out = await search('Ndola');
    const d = out.boundaries.find((b) => b.level === 'district');
    const ring = d.geometry.coordinates[0];
    assert.equal(d.geometry.type, 'Polygon');
    assert.deepEqual(ring[0], ring[ring.length - 1]);
    assert.ok(wktLength(ring) <= MAX_AREA_CHARS);
    assert.equal(ringSelfIntersects(ring), false);
    assert.ok(ring.every(([lon, lat]) => lon > 21 && lon < 34 && lat > -19 && lat < -7), 'inside Zambia, lon/lat order');
    assert.ok(d.maxDeviationM >= 0 && d.vertices === ring.length - 1);
  });

  it('carries licence and attribution on every result', async () => {
    const out = await search('Kitwe');
    out.boundaries.forEach((b) => {
      assert.ok(b.license && b.attribution && b.sourceLabel);
    });
    assert.ok(out.attribution.some((a) => /geoBoundaries/.test(a)));
  });

  it('prefix searches rank exact names first and need three characters', async () => {
    await assert.rejects(search('ch'), (e) => e.code === 'query_too_short');
    const ranked = rankPlaces(fixture.places, parseQuery('Chipa'));
    assert.ok(ranked.every((r) => r.nameNorm.startsWith('chipa')));
  });
});

describe('unknown places and failures', () => {
  it('a place the catalogue does not know goes to the live lookup, mapped to the same shape', async () => {
    const live = async () => ({
      results: [],
      pointResults: [{ id: 'node:1', name: 'Matero', displayName: 'Matero, Lusaka', level: 'suburb', center: [28.25, -15.37] }],
      cached: false,
    });
    const out = await searchPlaces('Matero', { repository, live });
    assert.equal(out.source, 'nominatim');
    assert.equal(out.boundaries.length, 0);
    assert.equal(out.locations[0].verified, false);
    assert.match(out.locations[0].warning, /Location only/);
    assert.match(out.notice, /No verified boundary/);
  });

  it('live lookups drop roads/offices/monuments: only real places can anchor a radius zone', async () => {
    const live = async () => ({
      results: [],
      pointResults: [
        { id: 'node:1', name: 'Matero', displayName: 'Matero, Chitimukulu Road', level: 'highway', center: [28.2, -15.3] },
        { id: 'node:2', name: 'Matero', displayName: 'Matero, Lusaka', level: 'man made', center: [28.2, -15.3] },
        { id: 'node:3', name: 'Mandevu', displayName: 'Mandevu, Lusaka', level: 'suburb', center: [28.3, -15.37] },
      ],
    });
    const out = await searchPlaces('Mandevu', { repository, live });
    assert.deepEqual(out.locations.map((l) => `${l.level}:${l.name}`), ['suburb:Mandevu']);
  });

  it('live polygon results are labelled by kind and never recommended', async () => {
    const live = async () => ({
      results: [{ id: 'relation:9', name: 'Somewhere', displayName: 'Somewhere District', level: 'district', geometry: { type: 'Polygon', coordinates: [[[1, 1], [2, 1], [2, 2], [1, 1]]] }, areaKm2: 5, vertices: 3, notes: {} }],
      pointResults: [],
    });
    const out = await searchPlaces('Somewhere', { repository, live });
    assert.equal(out.boundaries[0].kind, 'district');
    assert.equal(out.boundaries[0].recommended, false);
    assert.match(out.boundaries[0].warning, /larger administrative area/);
  });

  it('an unavailable catalogue (migration not applied) degrades to the live lookup', async () => {
    const broken = { listMetadata: async () => { throw new Error('relation "place_boundaries" does not exist'); }, getGeometries: async () => new Map() };
    const live = async () => ({ results: [], pointResults: [], cached: false });
    const out = await searchPlaces('Chipata', { repository: broken, live });
    assert.equal(out.source, 'nominatim');
  });

  it('a polygon row whose geometry is missing is never offered as verified', async () => {
    const lost = { listMetadata: repository.listMetadata, getGeometries: async () => new Map() };
    const live = async () => ({ results: [], pointResults: [], cached: false });
    const out = await searchPlaces('Kabwe', { repository: lost, live });
    assert.ok(out.boundaries.every((b) => b.geometry));
  });

  it('keeps the legacy response keys older clients read', async () => {
    const out = await search('Kitwe');
    assert.deepEqual(out.results, out.boundaries);
    assert.deepEqual(out.pointResults, out.locations);
  });
});
