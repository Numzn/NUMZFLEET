import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';
import { processTelemetryEvent } from './telemetryIngestion.js';

// Real Postgres — processTelemetryEvent's own DeviceAssignment/
// VehicleActivityState/telemetry_processed_events reads+writes, advisory
// locks, and idempotency ledger cannot be meaningfully exercised any other
// way. No live Traccar needed: processTelemetryEvent takes an already-shaped
// raw event and never itself calls out to Traccar.
const TEST_SLUG_PREFIX = 'telemetryingest-';
// Namespaced away from any real Traccar device id range.
const BASE_DEVICE_ID = 90_000_000 + (Date.now() % 1_000_000);
const BASE_EVENT_ID = 900_000_000_000 + Date.now();
let deviceCounter = 0;
let eventCounter = 0;
const nextDeviceId = () => BASE_DEVICE_ID + (deviceCounter += 1);
const nextEventId = () => BASE_EVENT_ID + (eventCounter += 1);

const createdCompanyIds = [];

after(async () => {
  const {
    Company, Vehicle, DeviceAssignment, VehicleActivityState, VehicleStateAuditEvent, TelemetryProcessedEvent,
  } = await import('../../models/index.js');
  if (!createdCompanyIds.length) return;
  const vehicles = await Vehicle.findAll({ where: { companyId: { [Op.in]: createdCompanyIds } } });
  const vehicleIds = vehicles.map((v) => v.id);
  if (vehicleIds.length) {
    await VehicleStateAuditEvent.destroy({ where: { vehicleId: { [Op.in]: vehicleIds } } });
    await VehicleActivityState.destroy({ where: { vehicleId: { [Op.in]: vehicleIds } } });
    await DeviceAssignment.destroy({ where: { vehicleId: { [Op.in]: vehicleIds } } });
  }
  await TelemetryProcessedEvent.destroy({ where: { eventId: { [Op.gte]: BASE_EVENT_ID } } });
  await Vehicle.destroy({ where: { companyId: { [Op.in]: createdCompanyIds } } });
  await Company.destroy({ where: { id: { [Op.in]: createdCompanyIds } } });
});

async function makeCompany() {
  const { Company } = await import('../../models/index.js');
  const company = await Company.create({
    id: uuid(),
    slug: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}`,
    name: 'Telemetry Ingestion Test Co',
    organizationType: 'customer',
    status: 'active',
  });
  createdCompanyIds.push(company.id);
  return company;
}

async function makeVehicleWithAssignment(companyId, deviceId, { assignedAt } = {}) {
  const { Vehicle, DeviceAssignment } = await import('../../models/index.js');
  const vehicle = await Vehicle.create({ id: uuid(), name: `Test Vehicle ${deviceId}`, companyId });
  await DeviceAssignment.create({
    id: uuid(), vehicleId: vehicle.id, deviceId, isActive: true, assignedAt: assignedAt ?? new Date(),
  });
  return vehicle;
}

function movingEvent({ eventId, deviceId, eventTime }) {
  return {
    event: { id: eventId, deviceId, type: 'devicemoving', eventTime },
    position: { speed: 20 },
    device: { id: deviceId, status: 'online', lastUpdate: eventTime },
  };
}

function stoppedEvent({ eventId, deviceId, eventTime }) {
  return {
    event: { id: eventId, deviceId, type: 'devicestopped', eventTime },
    position: { speed: 0 },
    device: { id: deviceId, status: 'online', lastUpdate: eventTime },
  };
}

describe('processTelemetryEvent — end-to-end webhook ingestion (real Postgres)', () => {
  it('a normal event persists the expected state and stateEnteredAt', async () => {
    const { VehicleActivityState } = await import('../../models/index.js');
    const company = await makeCompany();
    const deviceId = nextDeviceId();
    const vehicle = await makeVehicleWithAssignment(company.id, deviceId);
    const eventTime = '2026-09-06T10:00:00.000Z';

    await processTelemetryEvent(movingEvent({ eventId: nextEventId(), deviceId, eventTime }));

    const row = await VehicleActivityState.findOne({ where: { vehicleId: vehicle.id } });
    assert.equal(row.state, 'moving');
    assert.equal(new Date(row.stateEnteredAt).toISOString(), eventTime);
  });

  it('duplicate delivery of the same event id is a no-op the second time', async () => {
    const { VehicleActivityState } = await import('../../models/index.js');
    const company = await makeCompany();
    const deviceId = nextDeviceId();
    const vehicle = await makeVehicleWithAssignment(company.id, deviceId);
    const eventId = nextEventId();
    const raw = movingEvent({ eventId, deviceId, eventTime: '2026-09-06T10:00:00.000Z' });

    await processTelemetryEvent(raw);
    const first = await VehicleActivityState.findOne({ where: { vehicleId: vehicle.id } });

    await processTelemetryEvent(raw); // exact same event id, redelivered
    const second = await VehicleActivityState.findOne({ where: { vehicleId: vehicle.id } });

    assert.equal(second.state, first.state);
    assert.equal(new Date(second.stateEnteredAt).getTime(), new Date(first.stateEnteredAt).getTime());
    assert.equal(second.lastEvaluatedAt.getTime(), first.lastEvaluatedAt.getTime(), 'a true duplicate short-circuits before re-evaluating at all');
  });

  it('a delayed/out-of-order event does not regress a more-current persisted state', async () => {
    const { VehicleActivityState } = await import('../../models/index.js');
    const company = await makeCompany();
    const deviceId = nextDeviceId();
    const vehicle = await makeVehicleWithAssignment(company.id, deviceId);

    // 10:10 moving lands first (as it would in reality — this is the current event).
    await processTelemetryEvent(movingEvent({ eventId: nextEventId(), deviceId, eventTime: '2026-09-06T10:10:00.000Z' }));
    // Then a 10:05 stopped event, generated before the above but delivered late.
    await processTelemetryEvent(stoppedEvent({ eventId: nextEventId(), deviceId, eventTime: '2026-09-06T10:05:00.000Z' }));

    const row = await VehicleActivityState.findOne({ where: { vehicleId: vehicle.id } });
    assert.equal(row.state, 'moving', 'the delayed 10:05 stop must not overwrite the already-recorded 10:10 moving transition');
    assert.equal(new Date(row.stateEnteredAt).toISOString(), '2026-09-06T10:10:00.000Z');
  });

  it('two events for the same vehicle racing concurrently converge on the chronologically later one regardless of arrival order', async () => {
    const { VehicleActivityState } = await import('../../models/index.js');
    const company = await makeCompany();
    const deviceId = nextDeviceId();
    const vehicle = await makeVehicleWithAssignment(company.id, deviceId);

    const earlier = stoppedEvent({ eventId: nextEventId(), deviceId, eventTime: '2026-09-06T09:00:00.000Z' });
    const later = movingEvent({ eventId: nextEventId(), deviceId, eventTime: '2026-09-06T09:05:00.000Z' });

    // Fire the chronologically-later event first in wall-clock arrival order,
    // racing against the earlier one — the per-vehicle advisory lock
    // serializes the two, and the stale-evidence guard (not lock ordering
    // alone) is what guarantees the outcome is deterministic either way.
    await Promise.all([
      processTelemetryEvent(later),
      processTelemetryEvent(earlier),
    ]);

    const row = await VehicleActivityState.findOne({ where: { vehicleId: vehicle.id } });
    assert.equal(row.state, 'moving', 'the 09:05 event must win regardless of which settled its lock first');
    assert.equal(new Date(row.stateEnteredAt).toISOString(), '2026-09-06T09:05:00.000Z');
  });

  it('an event for a device with no active assignment is skipped, not crashed or misfiled', async () => {
    const { TelemetryProcessedEvent } = await import('../../models/index.js');
    const deviceId = nextDeviceId(); // deliberately never assigned to any vehicle
    const eventId = nextEventId();

    await processTelemetryEvent(movingEvent({ eventId, deviceId, eventTime: '2026-09-06T10:00:00.000Z' }));

    const outcome = await TelemetryProcessedEvent.findByPk(eventId);
    assert.equal(outcome.outcome, 'skipped_unmapped_device');
    assert.equal(outcome.vehicleId, null);
  });

  it('duplicate active assignments for the same device resolve deterministically to the most recently assigned vehicle', async () => {
    const { VehicleActivityState } = await import('../../models/index.js');
    const company = await makeCompany();
    const deviceId = nextDeviceId();
    // A known, tracked data-integrity gap (no DB constraint prevents this —
    // see docs/TENANCY_ARCHITECTURE.md §9) deliberately reproduced here to
    // prove the read path is deterministic rather than untested.
    const olderVehicle = await makeVehicleWithAssignment(company.id, deviceId, { assignedAt: new Date('2026-01-01T00:00:00.000Z') });
    const newerVehicle = await makeVehicleWithAssignment(company.id, deviceId, { assignedAt: new Date('2026-06-01T00:00:00.000Z') });

    await processTelemetryEvent(movingEvent({ eventId: nextEventId(), deviceId, eventTime: '2026-09-06T10:00:00.000Z' }));

    const newerRow = await VehicleActivityState.findOne({ where: { vehicleId: newerVehicle.id } });
    const olderRow = await VehicleActivityState.findOne({ where: { vehicleId: olderVehicle.id } });
    assert.ok(newerRow, 'the most-recently-assigned vehicle must receive the event');
    assert.equal(olderRow, null, 'the older assignment must not also receive it');
  });
});
