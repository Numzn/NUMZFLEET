import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { importCatalogue, rowProblem } from './catalogueImport.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/places.fixture.json', import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

/** In-memory stand-in for the model wrapper, recording every write. */
const makeStore = (initial = []) => {
  const rows = initial.map((r) => ({ ...clone(r), isActive: r.isActive ?? true }));
  const log = [];
  return {
    rows,
    log,
    findAll: async (sources) => rows.filter((r) => sources.includes(r.source)),
    create: async (row) => { log.push(['create', row.sourceId]); rows.push({ ...clone(row) }); },
    update: async (record, patch) => { log.push(['update', record.sourceId, Object.keys(patch)]); Object.assign(record, clone(patch)); },
  };
};

describe('row validation before import', () => {
  const polygon = fixture.places.find((p) => p.geometryType === 'Polygon');

  it('accepts the real catalogue rows', () => {
    fixture.places.forEach((p) => assert.equal(rowProblem(p), null, `${p.name}: ${rowProblem(p)}`));
  });

  it('rejects unusable geometry and missing licence', () => {
    assert.equal(rowProblem({ ...polygon, level: 'galaxy' }), 'bad_level');
    assert.equal(rowProblem({ ...polygon, license: '' }), 'missing_licence');
    assert.equal(rowProblem({ ...polygon, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] } }), 'ring_not_closed');
    assert.equal(rowProblem({ ...polygon, geometry: { type: 'Polygon', coordinates: [[[28, -15], [28.2, -15.2], [28.2, -15], [28, -15.2], [28, -15]]] } }), 'self_intersecting');
    assert.equal(rowProblem({ ...polygon, geometry: { type: 'MultiPolygon', coordinates: [] } }), 'not_polygon');
    assert.equal(rowProblem({ ...polygon, geometry: { type: 'Polygon', coordinates: [[[200, 0], [1, 0], [1, 1], [200, 0]]] } }), 'bad_ring');
    const dense = [];
    for (let i = 0; i < 600; i += 1) dense.push([28 + Math.cos(i) * 0.01 * (1 + i / 600), -15 + Math.sin(i) * 0.01 * (1 + i / 600)]);
    dense.push(dense[0]);
    assert.equal(rowProblem({ ...polygon, geometry: { type: 'Polygon', coordinates: [dense] } }), 'too_long_for_traccar');
  });

  it('a location is only ever a location: a Point cannot be passed off as a polygon', () => {
    const point = { ...polygon, geometryType: 'Point', validationStatus: 'location_only', geometry: { type: 'Point', coordinates: [32.6, -13.6] } };
    assert.equal(rowProblem(point), null);
    assert.equal(rowProblem({ ...point, validationStatus: 'valid' }), 'point_not_location_only');
    assert.equal(rowProblem({ ...polygon, geometryType: 'Polygon', geometry: { type: 'Point', coordinates: [1, 1] } }), 'not_polygon');
  });
});

describe('importCatalogue is idempotent', () => {
  it('first import creates every row, a repeat creates and changes nothing', async () => {
    const store = makeStore();
    const first = await importCatalogue(fixture.places, store);
    assert.equal(first.created, fixture.places.length);
    assert.equal(first.rejected.length, 0);
    store.log.length = 0;
    const second = await importCatalogue(fixture.places, store);
    assert.deepEqual([second.created, second.updated, second.unchanged], [0, 0, fixture.places.length]);
    assert.equal(store.log.length, 0, 'no writes at all on a repeat run');
    assert.equal(store.rows.length, fixture.places.length, 'no duplicates');
  });

  it('is not fooled by JSONB returning object keys in a different order', async () => {
    const reorder = (v) => (Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reorder(v[k])])) : v);
    const store = makeStore(fixture.places.map((p) => ({ ...p, geometry: reorder(p.geometry), notes: reorder(p.notes) })));
    const out = await importCatalogue(fixture.places, store);
    assert.deepEqual([out.created, out.updated, out.unchanged], [0, 0, fixture.places.length]);
  });

  it('a changed boundary is updated in place, other rows untouched', async () => {
    const store = makeStore();
    await importCatalogue(fixture.places, store);
    store.log.length = 0;
    const next = clone(fixture.places);
    next[0].sourceVersion = 'refreshed-2027';
    next[0].name = `${next[0].name}`;
    const out = await importCatalogue(next, store);
    assert.deepEqual([out.created, out.updated, out.unchanged], [0, 1, fixture.places.length - 1]);
    assert.equal(store.rows.length, fixture.places.length);
    assert.equal(store.rows[0].sourceVersion, 'refreshed-2027');
  });

  it('a place that disappears from its source is deactivated, never deleted, and can come back', async () => {
    const store = makeStore();
    await importCatalogue(fixture.places, store);
    const gone = fixture.places[1];
    const fewer = fixture.places.filter((p) => p !== gone);
    const out = await importCatalogue(fewer, store);
    assert.equal(out.deactivated, 1);
    assert.equal(store.rows.length, fixture.places.length, 'row kept');
    assert.equal(store.rows.find((r) => r.sourceId === gone.sourceId).isActive, false);
    const back = await importCatalogue(fixture.places, store);
    assert.equal(back.reactivated, 1);
    assert.equal(store.rows.find((r) => r.sourceId === gone.sourceId).isActive, true);
  });

  it('only sources present in the file are deactivated; other sources are left alone', async () => {
    const store = makeStore();
    await importCatalogue(fixture.places, store);
    const onlyGeo = fixture.places.filter((p) => p.source === 'geoboundaries');
    const osmBefore = store.rows.filter((r) => r.source === 'osm').map((r) => r.isActive);
    await importCatalogue(onlyGeo.slice(0, 2), store);
    assert.deepEqual(store.rows.filter((r) => r.source === 'osm').map((r) => r.isActive), osmBefore);
  });

  it('rejected rows are reported and never written; duplicates in a file collapse', async () => {
    const store = makeStore();
    const bad = { ...clone(fixture.places[0]), sourceId: 'bad-1', level: 'galaxy' };
    const dup = clone(fixture.places[0]);
    const out = await importCatalogue([...fixture.places, bad, dup], store);
    assert.deepEqual(out.rejected.map((r) => r.problem).sort(), ['bad_level', 'duplicate_in_file']);
    assert.equal(store.rows.length, fixture.places.length);
  });

  it('dry run reports what would change and writes nothing', async () => {
    const store = makeStore();
    const out = await importCatalogue(fixture.places, store, { dryRun: true });
    assert.equal(out.created, fixture.places.length);
    assert.equal(store.log.length, 0);
    assert.equal(store.rows.length, 0);
  });
});
