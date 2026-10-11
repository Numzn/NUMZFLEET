import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildMarkerFeatures } from './markerFeatures.js';

const devices = { 1: { id: 1 }, 2: { id: 2 }, 3: { id: 3 } };

const build = (positions, overrides = {}) => buildMarkerFeatures({
  positions,
  devices,
  selectedDeviceId: null,
  selectedSource: false,
  createProperties: (position) => ({ id: position.id, deviceId: position.deviceId }),
  ...overrides,
});

test('buildMarkerFeatures: coordinates are exactly the reported longitude/latitude', () => {
  const [feature] = build([{ id: 10, deviceId: 1, longitude: 28.2833, latitude: -15.4167 }]);

  assert.equal(feature.type, 'Feature');
  assert.equal(feature.geometry.type, 'Point');
  assert.deepEqual(feature.geometry.coordinates, [28.2833, -15.4167]);
});

test('buildMarkerFeatures: a new fix is applied directly, with no intermediate point from the previous fix', () => {
  const before = build([{ id: 10, deviceId: 1, longitude: 28.0, latitude: -15.0 }]);
  const after = build([{ id: 11, deviceId: 1, longitude: 28.5, latitude: -15.5 }]);

  assert.deepEqual(before[0].geometry.coordinates, [28.0, -15.0]);
  // The very first build after the update is already at the new fix — nothing
  // is blended with the prior coordinates.
  assert.deepEqual(after[0].geometry.coordinates, [28.5, -15.5]);
});

test('buildMarkerFeatures: repeated updates leave no stale or duplicate features', () => {
  const fixes = [
    { id: 1, deviceId: 1, longitude: 28.1, latitude: -15.1 },
    { id: 2, deviceId: 1, longitude: 28.2, latitude: -15.2 },
    { id: 3, deviceId: 1, longitude: 28.3, latitude: -15.3 },
  ];

  let features;
  fixes.forEach((fix) => {
    features = build([fix]);
  });

  assert.equal(features.length, 1);
  assert.deepEqual(features[0].geometry.coordinates, [28.3, -15.3]);
});

test('buildMarkerFeatures: main source excludes the selected device, selected source holds only it', () => {
  const positions = [
    { id: 1, deviceId: 1, longitude: 1, latitude: 1 },
    { id: 2, deviceId: 2, longitude: 2, latitude: 2 },
    { id: 3, deviceId: 3, longitude: 3, latitude: 3 },
  ];

  const main = build(positions, { selectedDeviceId: 2, selectedSource: false });
  const selected = build(positions, { selectedDeviceId: 2, selectedSource: true });

  assert.deepEqual(main.map((f) => f.properties.deviceId), [1, 3]);
  assert.deepEqual(selected.map((f) => f.properties.deviceId), [2]);
  assert.deepEqual(selected[0].geometry.coordinates, [2, 2]);
});

test('buildMarkerFeatures: selected source follows the new fix immediately, same as the main source', () => {
  const selected = build(
    [{ id: 21, deviceId: 2, longitude: 29.9, latitude: -14.9 }],
    { selectedDeviceId: 2, selectedSource: true },
  );

  assert.deepEqual(selected[0].geometry.coordinates, [29.9, -14.9]);
});

test('buildMarkerFeatures: positions for devices the user cannot see are dropped', () => {
  const features = build([
    { id: 1, deviceId: 1, longitude: 1, latitude: 1 },
    { id: 99, deviceId: 99, longitude: 9, latitude: 9 },
  ]);

  assert.deepEqual(features.map((f) => f.properties.deviceId), [1]);
});

test('buildMarkerFeatures: properties come from createProperties, not from the geometry', () => {
  const [feature] = build(
    [{ id: 10, deviceId: 1, longitude: 5, latitude: 6 }],
    { createProperties: (position) => ({ rotation: 90, deviceId: position.deviceId }) },
  );

  assert.deepEqual(feature.properties, { rotation: 90, deviceId: 1 });
});

test('buildMarkerFeatures: an empty position update yields no features, so stale markers are cleared', () => {
  assert.deepEqual(build([]), []);
  assert.deepEqual(build([], { selectedDeviceId: 2, selectedSource: true }), []);
});

test('buildMarkerFeatures: properties are only built for positions that survive filtering', () => {
  const seen = [];
  build(
    [
      { id: 1, deviceId: 1, longitude: 1, latitude: 1 },
      { id: 99, deviceId: 99, longitude: 9, latitude: 9 },
      { id: 2, deviceId: 2, longitude: 2, latitude: 2 },
    ],
    {
      selectedDeviceId: 2,
      selectedSource: false,
      createProperties: (position) => {
        seen.push(position.deviceId);
        return {};
      },
    },
  );

  assert.deepEqual(seen, [1]);
});

const readComponentSource = () => readFileSync(new URL('./EnhancedMarkers.js', import.meta.url), 'utf8');

/** Dependency identifiers of the `useEffect` whose body contains `anchor`. */
const effectDeps = (source, anchor) => {
  const start = source.indexOf(anchor);
  assert.notEqual(start, -1, `anchor not found in EnhancedMarkers.js: ${anchor}`);
  // Effect dependency arrays close at the component's 2-space indent.
  const open = source.indexOf('\n  }, [', start);
  const close = source.indexOf(']);', open);
  assert.ok(open !== -1 && close !== -1, `dependency array not found after: ${anchor}`);
  return source
    .slice(open + '\n  }, ['.length, close)
    .replace(/\/\/.*$/gm, '')
    .split(',')
    .map((dep) => dep.trim())
    .filter(Boolean);
};

test('EnhancedMarkers wiring: no position interpolation loop, uses the direct feature builder', () => {
  const source = readComponentSource();

  assert.ok(!source.includes('LERP_DURATION'), 'LERP_DURATION must not return');
  assert.ok(!source.includes('prevCoordsRef'), 'per-device previous-coordinate cache must not return');
  assert.ok(!source.includes('animFrameRef'), 'position animation frame ref must not return');
  assert.ok(source.includes('buildMarkerFeatures'), 'markers must be fed by buildMarkerFeatures');
});

test('EnhancedMarkers wiring: marker data is re-pushed whenever the sources are recreated', () => {
  const source = readComponentSource();
  const sourceDeps = effectDeps(source, '// Add sources');
  const dataDeps = effectDeps(source, 'Push the latest fixes straight into both GeoJSON sources');

  assert.ok(sourceDeps.length > 0, 'expected the source-creating effect to have dependencies');

  // The creating effect re-adds both sources empty on any of these changing;
  // the data effect must re-run with it or markers stay blank until the next
  // position update.
  const missing = sourceDeps.filter((dep) => !dataDeps.includes(dep));
  assert.deepEqual(missing, [], `data effect is missing source-lifecycle deps: ${missing.join(', ')}`);

  ['safePositions', 'devices', 'selectedDeviceId', 'selectedPosition'].forEach((dep) => {
    assert.ok(dataDeps.includes(dep), `data effect must depend on ${dep}`);
  });
});
