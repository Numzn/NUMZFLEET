import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

const { toServiceRecordDto } = await import('./serviceRecordService.js');
const { summarizeServiceRecordRows } = await import('../repositories/serviceRecordRepository.js');

test('toServiceRecordDto maps fleet vehicle fields', () => {
  const dto = toServiceRecordDto({
    id: 1,
    companyId: '00000000-0000-0000-0000-000000000001',
    fleetVehicleId: 'a7c8d9e0-1111-2222-3333-444455556666',
    deviceId: 42,
    title: 'Oil change',
    status: 'open',
    odometerKm: 12000,
    cost: 350,
    vendor: 'Garage A',
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-06-01T10:00:00Z'),
  });
  assert.equal(dto.fleetVehicleId, 'a7c8d9e0-1111-2222-3333-444455556666');
  assert.equal(dto.deviceId, 42);
  assert.equal(dto.title, 'Oil change');
  assert.equal(dto.status, 'scheduled');
});

test('toServiceRecordDto defaults scheduleResetStatus to not_applicable', () => {
  const dto = toServiceRecordDto({
    id: 2,
    companyId: '00000000-0000-0000-0000-000000000001',
    fleetVehicleId: 'a7c8d9e0-1111-2222-3333-444455556666',
    title: 'Log repair',
    status: 'completed',
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-06-01T10:00:00Z'),
  });
  assert.equal(dto.scheduleResetStatus, 'not_applicable');
  assert.equal(dto.scheduleResetError, null);
});

test('toServiceRecordDto surfaces a failed schedule reset for the frontend to retry', () => {
  const dto = toServiceRecordDto({
    id: 3,
    companyId: '00000000-0000-0000-0000-000000000001',
    fleetVehicleId: 'a7c8d9e0-1111-2222-3333-444455556666',
    maintenanceId: 2,
    title: 'Routine Service',
    status: 'completed',
    scheduleResetStatus: 'failed',
    scheduleResetError: 'Traccar service API not configured.',
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-06-01T10:00:00Z'),
  });
  assert.equal(dto.scheduleResetStatus, 'failed');
  assert.equal(dto.scheduleResetError, 'Traccar service API not configured.');
});

test('summarizeServiceRecordRows counts open and in-progress work', () => {
  const summary = summarizeServiceRecordRows([
    { status: 'open', completedAt: null },
    { status: 'in_progress', completedAt: null },
    { status: 'completed', completedAt: '2026-05-01T12:00:00Z' },
    { status: 'completed', completedAt: '2026-06-01T12:00:00Z' },
  ]);
  assert.equal(summary.openCount, 1);
  assert.equal(summary.inProgressCount, 1);
  assert.equal(summary.lastCompletedAt, '2026-06-01T12:00:00.000Z');
});

test('summarizeServiceRecordRows returns zeros when empty', () => {
  const summary = summarizeServiceRecordRows([]);
  assert.equal(summary.openCount, 0);
  assert.equal(summary.inProgressCount, 0);
  assert.equal(summary.lastCompletedAt, null);
});

// ---- the odometer typed on a completed service, and which tracker's schedule it rebases ----------------

const { resolveScheduleDeviceId, applyServiceCompletionOdometer } = await import('./serviceRecordService.js');

test('the schedule is found on the vehicle\'s CURRENT tracker even though the record names the old one', async () => {
  const owns = async (device, maintenance) => device === 9 && maintenance === 55; // schedules followed the vehicle to tracker 9
  const device = await resolveScheduleDeviceId(
    { fleetVehicleId: 'veh-1', record: { deviceId: 7, maintenanceId: 55 } },
    { resolveActiveDeviceId: async () => 9, deviceOwnsMaintenanceId: owns },
  );
  assert.equal(device, 9);
});

test('...and falls back to the record\'s tracker while the schedule re-link has not completed yet', async () => {
  const owns = async (device, maintenance) => device === 7 && maintenance === 55;
  const device = await resolveScheduleDeviceId(
    { fleetVehicleId: 'veh-1', record: { deviceId: 7, maintenanceId: 55 } },
    { resolveActiveDeviceId: async () => 9, deviceOwnsMaintenanceId: owns },
  );
  assert.equal(device, 7);
});

test('if Traccar cannot be asked, the vehicle\'s current tracker is the best guess', async () => {
  const device = await resolveScheduleDeviceId(
    { fleetVehicleId: 'veh-1', record: { deviceId: 7, maintenanceId: 55 } },
    { resolveActiveDeviceId: async () => 9, deviceOwnsMaintenanceId: async () => { throw new Error('mysql down'); } },
  );
  assert.equal(device, 9);
});

test('a record with no schedule resolves to the current tracker, or the recorded one if the vehicle has none', async () => {
  const deps = (active) => ({ resolveActiveDeviceId: async () => active, deviceOwnsMaintenanceId: async () => false });
  assert.equal(await resolveScheduleDeviceId({ fleetVehicleId: 'v', record: { deviceId: 7, maintenanceId: null } }, deps(9)), 9);
  assert.equal(await resolveScheduleDeviceId({ fleetVehicleId: 'v', record: { deviceId: 7, maintenanceId: null } }, deps(null)), 7);
  assert.equal(await resolveScheduleDeviceId({ fleetVehicleId: 'v', record: { deviceId: null, maintenanceId: null } }, deps(null)), null);
});

test('a service odometer is an observation by default: not attested, labelled as a service reading', async () => {
  let seen;
  await applyServiceCompletionOdometer(
    { fleetVehicleId: 'veh-1', odometerKm: '125400', actorUserId: 42 },
    { recordObservation: async (input) => { seen = input; return {}; } },
  );
  assert.equal(seen.vehicleId, 'veh-1');
  assert.equal(seen.odometerKm, 125400);
  assert.equal(seen.source, 'service');
  assert.equal(seen.confirmedPhysical, false, 'typing a number is not a physical verification');
  assert.equal(seen.actorUserId, 42);
});

test('only an explicit attestation makes a service odometer a physical verification', async () => {
  const seen = [];
  const deps = { recordObservation: async (input) => { seen.push(input); return {}; } };
  await applyServiceCompletionOdometer({ fleetVehicleId: 'v', odometerKm: 1, confirmedPhysical: true }, deps);
  await applyServiceCompletionOdometer({ fleetVehicleId: 'v', odometerKm: 1, confirmedPhysical: 'yes' }, deps);
  await applyServiceCompletionOdometer({ fleetVehicleId: 'v', odometerKm: 1, confirmedPhysical: 1 }, deps);
  assert.deepEqual(seen.map((s) => s.confirmedPhysical), [true, false, false]);
});

test('a refused service odometer propagates, so the caller does not complete the service', async () => {
  const refusal = Object.assign(new Error('implausible'), { statusCode: 422, code: 'implausible_increase' });
  await assert.rejects(
    () => applyServiceCompletionOdometer({ fleetVehicleId: 'v', odometerKm: 9e9 }, { recordObservation: async () => { throw refusal; } }),
    (error) => error.statusCode === 422 && error.code === 'implausible_increase',
  );
});
