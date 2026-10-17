import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  searchBoundaries, mapNominatimFeatures, normalizeQuery, BoundarySearchError, __resetBoundarySearchState,
} from './boundarySearchService.js';

const poly = [[[28.2, -15.4], [28.3, -15.4], [28.3, -15.3], [28.2, -15.3], [28.2, -15.4]]];
const feature = (over = {}) => ({
  type: 'Feature',
  properties: { osm_type: 'relation', osm_id: 1, name: 'Matero', display_name: 'Matero, Lusaka, Zambia', addresstype: 'suburb', address: { city: 'Lusaka' } },
  geometry: { type: 'Polygon', coordinates: poly },
  ...over,
});
const okFetch = (features, calls = []) => async (url) => {
  calls.push(url);
  return { ok: true, json: async () => ({ features }) };
};

describe('mapNominatimFeatures', () => {
  it('keeps boundaries, counts point-only and invalid, exposes level', () => {
    const out = mapNominatimFeatures([
      feature(),
      feature({ properties: { osm_type: 'node', osm_id: 2, name: 'Pin' }, geometry: { type: 'Point', coordinates: [28, -15] } }),
      feature({ geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] } }),
    ]);
    assert.equal(out.results.length, 1);
    assert.equal(out.pointOnly, 1);
    assert.equal(out.invalid, 1);
    assert.deepEqual(out.pointResults.map((r) => [r.name, r.center]), [['Pin', [28, -15]]]);
    assert.equal(out.results[0].level, 'suburb');
    assert.equal(out.results[0].parent, 'Lusaka');
  });

  it('distinguishes same-named places by id and level', () => {
    const out = mapNominatimFeatures([
      feature({ properties: { osm_type: 'relation', osm_id: 10, name: 'Lusaka', addresstype: 'city', display_name: 'Lusaka, Zambia' } }),
      feature({ properties: { osm_type: 'relation', osm_id: 11, name: 'Lusaka', addresstype: 'state', display_name: 'Lusaka Province, Zambia' } }),
    ]);
    assert.deepEqual(out.results.map((r) => r.id), ['relation:10', 'relation:11']);
    assert.deepEqual(out.results.map((r) => r.level), ['city', 'province / state']);
  });

  it('tolerates a malformed upstream body', () => {
    assert.deepEqual(mapNominatimFeatures(undefined).results, []);
  });
});

describe('searchBoundaries', () => {
  beforeEach(() => __resetBoundarySearchState());

  it('rejects short and overlong queries without calling upstream', async () => {
    let called = 0;
    const f = async () => { called += 1; };
    await assert.rejects(searchBoundaries(' a ', { fetchImpl: f }), (e) => e.code === 'query_too_short' && e.status === 400);
    await assert.rejects(searchBoundaries('x'.repeat(101), { fetchImpl: f }), (e) => e.code === 'query_too_long');
    assert.equal(called, 0);
  });

  it('requests polygons with a User-Agent and caches repeats (case/space-insensitive)', async () => {
    const calls = [];
    const first = await searchBoundaries('Matero', { fetchImpl: okFetch([feature()], calls) });
    const second = await searchBoundaries('  matero ', { fetchImpl: okFetch([], calls) });
    assert.equal(calls.length, 1);
    assert.match(calls[0], /polygon_geojson=1/);
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(second.results.length, 1);
  });

  it('maps upstream failure to 502 and does not cache it', async () => {
    const bad = async () => ({ ok: false, status: 500 });
    await assert.rejects(searchBoundaries('Mandevu', { fetchImpl: bad }), (e) => e instanceof BoundarySearchError && e.status === 502);
    const calls = [];
    const r = await searchBoundaries('Mandevu', { fetchImpl: okFetch([feature()], calls) });
    assert.equal(r.cached, false);
    assert.equal(calls.length, 1);
  });

  it('retries a transient network error once, then gives up as unreachable', async () => {
    let n = 0;
    const flaky = async () => { n += 1; if (n === 1) throw new Error('reset'); return { ok: true, json: async () => ({ features: [feature()] }) }; };
    const r = await searchBoundaries('Chilanga', { fetchImpl: flaky });
    assert.equal(n, 2);
    assert.equal(r.results.length, 1);
    __resetBoundarySearchState();
    let m = 0;
    await assert.rejects(searchBoundaries('Lusaka', { fetchImpl: async () => { m += 1; throw new Error('boom'); } }), (e) => e.code === 'upstream_unreachable');
    assert.equal(m, 3);
  });

  it('maps timeout without retrying', async () => {
    let m = 0;
    const t0 = async () => { m += 1; const e = new Error('t'); e.name = 'TimeoutError'; throw e; };
    await assert.rejects(searchBoundaries('Lusaka', { fetchImpl: t0 }), (e) => e.status === 504);
    assert.equal(m, 1);
  });

  it('maps timeout status', async () => {
    const t = async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; };
    await assert.rejects(searchBoundaries('Kabwe', { fetchImpl: t }), (e) => e.status === 504);
  });

  it('normalizeQuery collapses whitespace', () => {
    assert.equal(normalizeQuery('  Mat   ero '), 'Mat ero');
  });
});
