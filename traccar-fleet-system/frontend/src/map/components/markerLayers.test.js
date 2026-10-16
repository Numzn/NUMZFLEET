import test from 'node:test';
import assert from 'node:assert/strict';
import { expression, latest, validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

import {
  ICON_SIZE_STOPS,
  SELECTED_SCALE,
  iconSizeExpression,
  vehicleLayerSpecs,
} from './markerLayers.js';
import { CAR_RING_RADIUS_PX } from '../core/vehicleSprites.js';

const OPTIONS = { iconScale: 0.8, titleField: 'name', fonts: ['Noto Sans Regular'] };

const styleWith = (layers) => ({
  version: 8,
  glyphs: 'https://example.invalid/{fontstack}/{range}.pbf',
  sources: { veh: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
  layers,
});

const layerNamed = (layers, id) => layers.find((layer) => layer.id === id);

/** Evaluate a zoom/feature dependent paint expression the way MapLibre would. */
const evaluate = (value, spec, zoom, properties) => {
  const compiled = expression.createPropertyExpression(value, spec);
  assert.equal(compiled.result, 'success', JSON.stringify(compiled.value));
  return compiled.value.evaluate({ zoom }, { type: 'Point', properties, id: 1 });
};
const radiusAt = (layers, id, zoom, properties) => evaluate(
  layerNamed(layers, id).paint['circle-radius'],
  latest.paint_circle['circle-radius'],
  zoom,
  properties,
);

test('every layer definition passes the official MapLibre style validator', () => {
  [0.8, 1].forEach((iconScale) => {
    ['name', undefined].forEach((titleField) => {
      const layers = vehicleLayerSpecs('veh', { ...OPTIONS, iconScale, titleField });
      assert.deepEqual(validateStyleMin(styleWith(layers)), [], `iconScale ${iconScale}, titleField ${titleField}`);
    });
  });
});

test('layers are created in draw order and the heading cone sits UNDER the vehicle icon', () => {
  const ids = vehicleLayerSpecs('veh', OPTIONS).map((layer) => layer.id);
  assert.deepEqual(ids, [
    'pulse-mov-veh', 'pulse-idle-veh', 'telemetry-ring-veh', 'telemetry-core-veh', 'direction-veh', 'veh',
  ]);
});

test('layer ids follow the naming the cleanup code and click handling rely on', () => {
  // EnhancedMarkers removes layers as prefix + sourceId for these prefixes.
  const prefixes = ['pulse-mov-', 'pulse-idle-', 'telemetry-ring-', 'telemetry-core-', '', 'direction-'];
  const ids = new Set(vehicleLayerSpecs('src-1', OPTIONS).map((layer) => layer.id));
  prefixes.forEach((prefix) => assert.ok(ids.has(`${prefix}src-1`), `missing ${prefix}src-1`));
});

test('car icon rotates with the smoothed heading; other vehicle kinds never rotate', () => {
  const icon = layerNamed(vehicleLayerSpecs('veh', OPTIONS), 'veh').layout['icon-rotate'];
  const rotation = (props) => evaluate(icon, latest.layout_symbol['icon-rotate'], 15, props);

  assert.equal(rotation({ topDown: 1, heading: 135 }), 135);
  assert.equal(rotation({ topDown: 1, heading: 0 }), 0);
  assert.equal(rotation({ topDown: 0, heading: 135 }), 0, 'a puck stays upright');
  assert.equal(rotation({ topDown: 1 }), 0, 'a missing heading does not produce NaN');
});

test('the icon and the heading cone use the same size and rotate with the map', () => {
  const layers = vehicleLayerSpecs('veh', OPTIONS);
  const icon = layerNamed(layers, 'veh').layout;
  const cone = layerNamed(layers, 'direction-veh').layout;
  assert.deepEqual(cone['icon-size'], icon['icon-size']);
  assert.equal(icon['icon-rotation-alignment'], 'map');
  assert.equal(cone['icon-rotation-alignment'], 'map');
  assert.equal(cone['icon-image'], 'heading-cone');
  assert.deepEqual(icon['icon-size'], iconSizeExpression(0.8));
});

test('the heading cone follows the smoothed heading and shows only when the feature asks for it', () => {
  const cone = layerNamed(vehicleLayerSpecs('veh', OPTIONS), 'direction-veh');
  assert.deepEqual(cone.layout['icon-rotate'], ['to-number', ['get', 'heading'], 0]);
  assert.ok(JSON.stringify(cone.filter).includes('"direction"'), 'driven by the existing direction flag');
});

test('selected vehicle bump scales the icon-size stops', () => {
  const bumped = iconSizeExpression(0.8, SELECTED_SCALE);
  const flat = iconSizeExpression(0.8);
  ICON_SIZE_STOPS.forEach((_, i) => {
    const sizeIndex = 4 + i * 2;
    assert.ok(Math.abs(bumped[sizeIndex] - flat[sizeIndex] * SELECTED_SCALE) < 1e-12);
  });
});

test('puck sizing is unchanged for non-car vehicles', () => {
  const layers = vehicleLayerSpecs('veh', OPTIONS);
  const puck = (id, zoom, markerSelected) => radiusAt(layers, id, zoom, { topDown: 0, markerSelected });

  assert.equal(puck('telemetry-ring-veh', 14, 0), 12.1);
  assert.equal(puck('telemetry-ring-veh', 14, 1), 13.8);
  assert.equal(puck('telemetry-core-veh', 14, 0), 9.35);
  assert.equal(puck('pulse-mov-veh', 14, 0), 22);
  assert.equal(puck('pulse-idle-veh', 14, 1), 21);
});

test('a top-down car gets a ring scaled like its sprite, with core and aura around it', () => {
  const layers = vehicleLayerSpecs('veh', OPTIONS);
  const car = (id, zoom, markerSelected = 0) => radiusAt(layers, id, zoom, { topDown: 1, markerSelected });

  // icon-size at zoom 14 (between the 10 and 15 stops) times the user's icon scale.
  const iconSize14 = (0.76 + ((14 - 10) / 5) * (0.94 - 0.76)) * 0.8;
  const ring = CAR_RING_RADIUS_PX * iconSize14;

  assert.ok(Math.abs(car('telemetry-ring-veh', 14) - ring) < 1e-9);
  assert.ok(Math.abs(car('telemetry-ring-veh', 14, 1) - ring * SELECTED_SCALE) < 1e-9, 'selected is bumped like the icon');
  assert.ok(Math.abs(car('telemetry-core-veh', 14) - (ring - 2)) < 1e-9, 'dark backdrop just inside the ring');
  assert.ok(car('pulse-mov-veh', 14) > car('telemetry-ring-veh', 14), 'aura extends past the ring');
  assert.ok(car('pulse-idle-veh', 14) > car('telemetry-ring-veh', 14));
});

test('the car ring is always bigger than the car and grows with zoom and with the icon scale', () => {
  const small = vehicleLayerSpecs('veh', { ...OPTIONS, iconScale: 0.8 });
  const large = vehicleLayerSpecs('veh', { ...OPTIONS, iconScale: 1 });
  const ring = (layers, zoom) => radiusAt(layers, 'telemetry-ring-veh', zoom, { topDown: 1, markerSelected: 0 });

  assert.ok(ring(small, 18) > ring(small, 9));
  assert.ok(ring(large, 14) > ring(small, 14));
  // The sprite is 64 logical px wide with a 46 px long car: half of that is 23 px at icon-size 1.
  assert.ok(CAR_RING_RADIUS_PX > 23, 'the ring clears the car at the same scale');
});

test('a top-down car label sits further out than a puck label, clear of its ring', () => {
  const offset = layerNamed(vehicleLayerSpecs('veh', OPTIONS), 'veh').layout['text-offset'];
  const at = (topDown) => evaluate(offset, latest.layout_symbol['text-offset'], 15, { topDown });

  assert.ok(at(1)[1] > at(0)[1]);
  assert.equal(at(0)[1], 1.58 * 0.8, 'puck label position unchanged');
});
