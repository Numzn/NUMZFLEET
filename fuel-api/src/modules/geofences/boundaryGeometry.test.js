import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBoundaryGeometry, wktLength, MAX_AREA_CHARS, ringAreaKm2, ringSelfIntersects,
} from './boundaryGeometry.js';

// lon,lat order, Lusaka-ish
const square = (lon, lat, d) => [[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]];

describe('normalizeBoundaryGeometry', () => {
  it('accepts a Polygon and keeps lon,lat order', () => {
    const r = normalizeBoundaryGeometry({ type: 'Polygon', coordinates: [square(28.2, -15.4, 0.1)] });
    assert.equal(r.ok, true);
    assert.deepEqual(r.geometry.coordinates[0][0], [28.2, -15.4]);
    assert.ok(r.areaKm2 > 100 && r.areaKm2 < 130, `area ${r.areaKm2}`);
    assert.equal(r.notes.droppedParts, 0);
  });

  it('rejects points and lines: a pin is not a boundary', () => {
    assert.deepEqual(normalizeBoundaryGeometry({ type: 'Point', coordinates: [28, -15] }), { ok: false, reason: 'not_an_area' });
    assert.equal(normalizeBoundaryGeometry({ type: 'LineString', coordinates: [[0, 0], [1, 1]] }).reason, 'not_an_area');
    assert.equal(normalizeBoundaryGeometry(null).reason, 'no_geometry');
  });

  it('MultiPolygon keeps the largest part and reports what was dropped', () => {
    const r = normalizeBoundaryGeometry({
      type: 'MultiPolygon',
      coordinates: [[square(28, -15, 0.01)], [square(28.2, -15.4, 0.1), square(28.22, -15.38, 0.01)]],
    });
    assert.equal(r.ok, true);
    assert.equal(r.notes.droppedParts, 1);
    assert.equal(r.notes.droppedHoles, 1);
    assert.deepEqual(r.geometry.coordinates[0][0], [28.2, -15.4]);
  });

  it('rejects out-of-range or swapped coordinates', () => {
    // lat/lon swapped: "lon" -15, "lat" 28 is valid range, but 28.2 as lat is fine; use >90 lat
    const bad = [[28, 95], [29, 95], [29, 96], [28, 96], [28, 95]];
    assert.equal(normalizeBoundaryGeometry({ type: 'Polygon', coordinates: [bad] }).reason, 'invalid_geometry');
  });

  it('rejects degenerate rings and NaN', () => {
    assert.equal(normalizeBoundaryGeometry({ type: 'Polygon', coordinates: [[[1, 1], [1, 1], [1, 1], [1, 1]]] }).reason, 'invalid_geometry');
    assert.equal(normalizeBoundaryGeometry({ type: 'Polygon', coordinates: [[[0, 0], [1, NaN], [1, 1], [0, 0]]] }).reason, 'invalid_geometry');
    assert.equal(normalizeBoundaryGeometry({ type: 'Polygon', coordinates: [] }).reason, 'invalid_geometry');
  });

  it('rejects absurdly large areas', () => {
    assert.equal(normalizeBoundaryGeometry({ type: 'Polygon', coordinates: [square(10, -20, 30)] }).reason, 'too_large');
  });

  it('simplifies a dense ring to fit the Traccar area column', () => {
    const ring = [];
    const n = 3000;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * 2 * Math.PI;
      ring.push([28.3 + 0.05 * Math.cos(a), -15.4 + 0.05 * Math.sin(a)]);
    }
    ring.push(ring[0]);
    const r = normalizeBoundaryGeometry({ type: 'Polygon', coordinates: [ring] });
    assert.equal(r.ok, true);
    assert.ok(wktLength(r.geometry.coordinates[0]) <= MAX_AREA_CHARS);
    assert.equal(r.notes.simplified, true);
    const orig = ringAreaKm2(ring);
    assert.ok(Math.abs(r.areaKm2 - orig) / orig < 0.05, 'area preserved within 5%');
    const c = r.geometry.coordinates[0];
    assert.deepEqual(c[0], c[c.length - 1], 'ring closed');
  });

  it('rejects a bow-tie (self-intersecting) outline instead of saving it', () => {
    const bow = [[28, -15], [28.2, -15.2], [28.2, -15], [28, -15.2], [28, -15]];
    assert.equal(ringSelfIntersects(bow), true);
    assert.equal(normalizeBoundaryGeometry({ type: 'Polygon', coordinates: [bow] }).reason, 'self_intersecting');
    assert.equal(ringSelfIntersects(square(28, -15, 0.1)), false);
  });

  it('reports how far simplification may have moved the outline, and what a MultiPolygon dropped', () => {
    const ring = [];
    for (let i = 0; i < 3000; i += 1) {
      const a = (i / 3000) * 2 * Math.PI;
      ring.push([28.3 + 0.05 * Math.cos(a), -15.4 + 0.05 * Math.sin(a)]);
    }
    ring.push(ring[0]);
    const r = normalizeBoundaryGeometry({ type: 'MultiPolygon', coordinates: [[ring], [square(29, -14, 0.01)]] });
    assert.equal(r.ok, true);
    assert.equal(r.originalVertices, 3000);
    assert.ok(r.maxDeviationM > 0 && r.maxDeviationM < 200, `deviation ${r.maxDeviationM}`);
    assert.equal(r.notes.droppedParts, 1);
    assert.ok(r.notes.droppedAreaPct > 0 && r.notes.droppedAreaPct < 2);
  });
});
