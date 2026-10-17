import test from 'node:test';
import assert from 'node:assert/strict';
import {
  geofenceKind, filterGeofences, boundaryToGeofenceBody, splitAssignableVehicles, permissionBodies, vehicleDeviceId,
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
