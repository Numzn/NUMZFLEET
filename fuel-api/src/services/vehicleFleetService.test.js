import test from 'node:test';
import assert from 'node:assert/strict';
import { toMergedDto } from './vehicleFleetService.js';

const VEHICLE = {
  id: 'v-1',
  name: 'TOYOTA ALLION',
  plateNumber: 'CAC 4222',
  notes: null,
  make: null,
  model: null,
  homeBaseLabel: null,
  photoFileId: null,
};

test('toMergedDto has no per-vehicle query path (stays synchronous)', () => {
  // If odometer resolution needed a DB/Traccar call per vehicle, this function
  // would have to become async. Structurally asserting it does not is the
  // guarantee that batching happens once at the caller, not per row here.
  assert.notEqual(toMergedDto.constructor.name, 'AsyncFunction');
  const result = toMergedDto(VEHICLE, null, new Map(), new Map(), new Map());
  assert.ok(!(result instanceof Promise));
});

test('toMergedDto: unassigned vehicle gets the shared unavailable odometer defaults', () => {
  const dto = toMergedDto(VEHICLE, null, new Map(), new Map(), new Map());
  assert.equal(dto.odometerKm, null);
  assert.equal(dto.odometerConfidence, 'unavailable');
  assert.equal(dto.odometerDriftPct, null);
  assert.equal(dto.odometerDriftClass, 'unknown');
  // Existing payload fields remain compatible.
  assert.equal(dto.device, null);
  assert.equal(dto.position, null);
  assert.equal(dto.vehicleSpec, null);
  assert.equal(dto.name, 'TOYOTA ALLION');
  assert.equal(dto.plateNumber, 'CAC 4222');
});

test('toMergedDto: canonical odometer matches the real dev vehicle (deviceId 4) resolved via batch resolver', () => {
  // Live values captured from the dev DB (tc_devices/tc_positions deviceId 4,
  // vehicle_specs verifiedOdometerKm=1166 / verifiedTraccarDistance=1162.1) —
  // same fixture already proven byte-identical against the async per-device
  // resolver in the prior checkpoint's live equivalence check.
  const deviceId = 4;
  const assignment = { deviceId, assignedAt: new Date('2026-06-01T00:00:00.000Z') };
  const deviceMap = new Map([[deviceId, {
    id: deviceId,
    name: 'TOYOTA ALLION',
    status: 'offline',
    uniqueid: '9176778018',
    lastupdate: '2026-06-06T23:28:15.000Z',
    attributes: {},
  }]]);
  const positionMap = new Map([[deviceId, {
    deviceId,
    latitude: -15.4,
    longitude: 28.3,
    speed: 0,
    course: 0,
    altitude: 0,
    fixtime: '2026-06-06T23:28:12.000Z',
    attributes: { ignition: false, distance: 0.0, totalDistance: 1162082.5618777191 },
  }]]);
  const specMap = new Map([[deviceId, {
    deviceId,
    tankCapacity: 60,
    fuelEfficiency: 10,
    fuelType: 'Petrol',
    verifiedOdometerKm: 1166,
    verifiedOdometerAt: '2026-07-02T06:54:13.588Z',
    verifiedOdometerSource: 'manual',
    verifiedTraccarDistance: 1162.1,
  }]]);

  const dto = toMergedDto(VEHICLE, assignment, deviceMap, positionMap, specMap);

  assert.equal(dto.odometerKm, 1166);
  assert.equal(dto.odometerConfidence, 'high');
  assert.equal(dto.odometerDriftPct, 0);
  assert.equal(dto.odometerDriftClass, 'excellent');
  // Existing payload fields remain compatible and independently correct.
  assert.equal(dto.device.status, 'offline');
  assert.equal(dto.vehicleSpec.tankCapacity, 60);
});

test('toMergedDto: missing telemetry/spec evidence resolves to unavailable, not zero', () => {
  const deviceId = 99;
  const assignment = { deviceId, assignedAt: new Date() };
  const deviceMap = new Map([[deviceId, { id: deviceId, name: 'X', status: 'unknown', attributes: {} }]]);
  const positionMap = new Map(); // no position at all
  const specMap = new Map(); // no verified anchor at all

  const dto = toMergedDto(VEHICLE, assignment, deviceMap, positionMap, specMap);

  assert.equal(dto.odometerKm, null);
  assert.equal(dto.odometerConfidence, 'unavailable');
});

test('toMergedDto: two vehicles resolve independently from the same already-batched maps', () => {
  const deviceMap = new Map([
    [1, { id: 1, status: 'online', lastupdate: new Date().toISOString(), attributes: {} }],
    [2, { id: 2, status: 'online', lastupdate: new Date().toISOString(), attributes: {} }],
  ]);
  const positionMap = new Map([
    [1, { deviceId: 1, latitude: 0, longitude: 0, fixtime: new Date().toISOString(), attributes: { totalDistance: 12000 } }],
    [2, { deviceId: 2, latitude: 0, longitude: 0, fixtime: new Date().toISOString(), attributes: { totalDistance: 500000 } }],
  ]);
  const specMap = new Map([
    [1, { deviceId: 1, verifiedOdometerKm: 12, verifiedTraccarDistance: 10 }],
    [2, { deviceId: 2, verifiedOdometerKm: 600, verifiedTraccarDistance: 480 }],
  ]);

  const dtoA = toMergedDto({ ...VEHICLE, id: 'a' }, { deviceId: 1, assignedAt: new Date() }, deviceMap, positionMap, specMap);
  const dtoB = toMergedDto({ ...VEHICLE, id: 'b' }, { deviceId: 2, assignedAt: new Date() }, deviceMap, positionMap, specMap);

  // Each vehicle's odometer must come from its own device/position/spec row,
  // not leak from the other (the shared-timer/shared-selector class of bug
  // this whole audit started from).
  assert.equal(dtoA.odometerKm, 14); // 12 + (10 - 10)
  assert.equal(dtoB.odometerKm, 620); // 600 + (500 - 480)
  assert.notEqual(dtoA.odometerKm, dtoB.odometerKm);
});
