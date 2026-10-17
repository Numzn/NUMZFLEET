import test from 'node:test';
import assert from 'node:assert/strict';
import {
  geofenceKind, filterGeofences, boundaryToGeofenceBody, splitAssignableVehicles, permissionBodies, vehicleDeviceId,
  radiusZoneBody, radiusPreviewGeometry, defaultRadiusName, RADIUS_MIN_M, RADIUS_MAX_M,
} from './geofenceHelpers.js';

const ring = [[28.2, -15.4], [28.3, -15.4], [28.3, -15.3], [28.2, -15.4]];

test('manual regression: kinds of existing Traccar areas are recognised', () => {
  assert.equal(geofenceKind('CIRCLE (-15.4 28.3, 500)'), 'Circle');
  assert.equal(geofenceKind('POLYGON ((-15.4 28.2, -15.4 28.3, -15.3 28.3, -15.4 28.2))'), 'Polygon');
  assert.equal(geofenceKind('LINESTRING (-15.4 28.2, -15.3 28.3)'), 'Line');
  assert.equal(geofenceKind(undefined), 'Other');
});

test('filterGeofences is case-insensitive, sorted, and blank returns all', () => {
  const items = { 1: { id: 1, name: 'Matero' }, 2: { id: 2, name: 'Airport', description: 'near Matero road' }, 3: { id: 3, name: 'Kabwe' } };
  assert.deepEqual(filterGeofences(items, '').map((g) => g.id), [2, 3, 1]);
  assert.deepEqual(filterGeofences(items, ' MATERO ').map((g) => g.id), [2, 1]);
  assert.deepEqual(filterGeofences(items, 'zzz'), []);
  assert.deepEqual(filterGeofences(undefined, 'x'), []);
});

test('boundary body: lon,lat GeoJSON becomes lat-lon WKT (coordinate order)', () => {
  const body = boundaryToGeofenceBody('  Matero  ', { type: 'Polygon', coordinates: [ring] });
  assert.equal(body.name, 'Matero');
  assert.match(body.area, /^POLYGON/);
  assert.ok(body.area.includes('-15.4 28.2'), body.area);
  assert.ok(!body.area.includes('28.2 -15.4'), 'must not leave lon,lat order');
});

test('boundary body refuses non-areas and blank names', () => {
  assert.throws(() => boundaryToGeofenceBody('x', { type: 'Point', coordinates: [28, -15] }), /polygon/i);
  assert.throws(() => boundaryToGeofenceBody('x', { type: 'MultiPolygon', coordinates: [[ring]] }), /polygon/i);
  assert.throws(() => boundaryToGeofenceBody('x', null), /polygon/i);
  assert.throws(() => boundaryToGeofenceBody('   ', { type: 'Polygon', coordinates: [ring] }), /name/i);
  assert.throws(() => boundaryToGeofenceBody('x'.repeat(129), { type: 'Polygon', coordinates: [ring] }), /128/);
  assert.doesNotThrow(() => boundaryToGeofenceBody('x'.repeat(128), { type: 'Polygon', coordinates: [ring] }));
});

test('vehicle assignment reuses the Traccar device↔geofence permission shape (real /api/vehicles shape)', () => {
  const vehicles = [
    { id: 'a', assignment: { deviceId: 12 }, device: { id: 12 } },
    { id: 'b', assignment: null, device: null },
    { id: 'c' },
    { id: 'd', assignment: { deviceId: '7' } },
    { id: 'e', device: { id: 9 } },
    { id: 'f', assignment: { deviceId: 0 } },
  ];
  const { assignable, unassignable } = splitAssignableVehicles(vehicles);
  assert.deepEqual(assignable.map((v) => v.id), ['a', 'd', 'e']);
  assert.equal(unassignable, 3);
  assert.deepEqual(permissionBodies(99, assignable), [
    { deviceId: 12, geofenceId: 99 },
    { deviceId: 7, geofenceId: 99 },
    { deviceId: 9, geofenceId: 99 },
  ]);
  assert.equal(vehicleDeviceId(null), null);
});

test('list labels say what a geofence really is', () => {
  assert.equal(geofenceKind('POLYGON ((1 1, 1 2, 2 2, 1 1))', { numzLevel: 'district' }), 'District boundary');
  assert.equal(geofenceKind('CIRCLE (-15.4 28.3, 2000)', { numzZone: 'radius' }), 'Radius zone');
  assert.equal(geofenceKind('CIRCLE (-15.4 28.3, 2000)', {}), 'Circle');
});

test('catalogue-created boundary records its source and level in attributes', () => {
  const body = boundaryToGeofenceBody('Chipata district', { type: 'Polygon', coordinates: [ring] }, { id: 'geoboundaries:abc', level: 'district' });
  assert.deepEqual(body.attributes, { numzSource: 'geoboundaries:abc', numzLevel: 'district' });
});

test('radius zone is a real Traccar CIRCLE in lat-lon order, labelled as a radius zone', () => {
  const body = radiusZoneBody('Chipata — 2 km radius zone', [32.6447, -13.6398], 2000, 'Chipata');
  assert.equal(body.area, 'CIRCLE (-13.639800 32.644700, 2000)');
  assert.deepEqual(body.attributes, { numzZone: 'radius', numzRadiusM: '2000', numzPlace: 'Chipata' });
  assert.equal(defaultRadiusName('Chipata', 2000), 'Chipata — 2 km radius zone');
  assert.equal(defaultRadiusName('Chipata', 500), 'Chipata — 500 m radius zone');
});

test('radius zone rejects bad radius, bad centre and blank name', () => {
  assert.throws(() => radiusZoneBody('x', [32, -13], RADIUS_MIN_M - 1), /Radius/);
  assert.throws(() => radiusZoneBody('x', [32, -13], RADIUS_MAX_M + 1), /Radius/);
  assert.throws(() => radiusZoneBody('x', [32, -13], Number.NaN), /Radius/);
  assert.throws(() => radiusZoneBody('x', [200, -13], 1000), /location/);
  assert.throws(() => radiusZoneBody('x', null, 1000), /location/);
  assert.throws(() => radiusZoneBody('', [32, -13], 1000), /name/i);
});

test('radius preview polygon is closed and its radius matches the saved circle', () => {
  const g = radiusPreviewGeometry([32.6447, -13.6398], 2000);
  const r = g.coordinates[0];
  assert.deepEqual(r[0], r[r.length - 1]);
  const R = 6371008.8;
  const rad = (d) => (d * Math.PI) / 180;
  const dist = ([lo1, la1], [lo2, la2]) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2));
  r.forEach((p) => assert.ok(Math.abs(dist([32.6447, -13.6398], p) - 2000) < 5, 'every preview vertex within 5 m of the saved radius'));
  assert.equal(radiusPreviewGeometry([32, -13], 5), null);
});
