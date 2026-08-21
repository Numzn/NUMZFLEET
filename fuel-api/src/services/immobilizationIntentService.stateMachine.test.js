/**
 * Real-DB behavioral tests for the state-machine-critical paths in
 * evaluateOneIntent/cancelIntent — Postgres only. The expiry branch always
 * runs first and unconditionally, before any Traccar telemetry call, so
 * these are safe to run without Traccar configured: an expired intent (or a
 * terminal one, in the defense-in-depth case below) never reaches
 * loadTelemetryForDevice. See immobilizationIntentService.js's
 * evaluateOneIntent — do not restructure that ordering without re-checking
 * this assumption.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { Op } from 'sequelize';
import { v4 as uuid } from 'uuid';
import {
  evaluateOneIntent,
  cancelIntent,
  deviceMatchesActiveAssignment,
} from './immobilizationIntentService.js';

const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const createdVehicleIds = [];

after(async () => {
  const { Vehicle } = await import('../models/index.js');
  if (createdVehicleIds.length) {
    await Vehicle.destroy({ where: { id: { [Op.in]: createdVehicleIds } } });
  }
  // cancelIntent/evaluateOneIntent's real notifyImmobilizationTransition call resolves
  // its audience via getManagerUserIds(), which lazily opens a Traccar MySQL pool
  // (config/traccar.js's getTraccarPool) — nothing else in this file touches Traccar,
  // so without an explicit close that pool is the one lingering handle keeping this
  // process alive after the last test finishes.
  const { closeTraccarConnection } = await import('../config/traccar.js');
  await closeTraccarConnection();
});

async function makeVehicle() {
  const { Vehicle } = await import('../models/index.js');
  const vehicle = await Vehicle.create({
    name: `StateMachine Test Vehicle ${uuid().substring(0, 8)}`,
    companyId: DEFAULT_COMPANY_ID,
  });
  createdVehicleIds.push(vehicle.id);
  return vehicle;
}

async function makeIntent(vehicleId, overrides = {}) {
  const { VehicleImmobilizationIntent } = await import('../models/index.js');
  return VehicleImmobilizationIntent.create({
    vehicleId,
    deviceId: 999999,
    action: 'immobilize',
    status: 'pending',
    createdByUserId: 1,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    ...overrides,
  });
}

async function reload(intent) {
  const { VehicleImmobilizationIntent } = await import('../models/index.js');
  return VehicleImmobilizationIntent.findByPk(intent.id);
}

describe('evaluateOneIntent — TTL expiry', () => {
  it('expires a pending intent past its TTL', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, {
      status: 'pending',
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await evaluateOneIntent(intent);
    assert.deepEqual(result, { claimed: false, delivered: false });

    const row = await reload(intent);
    assert.equal(row.status, 'expired');
  });

  it('expires a monitoring intent past its TTL', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, {
      status: 'monitoring',
      expiresAt: new Date(Date.now() - 1000),
    });

    await evaluateOneIntent(intent);

    const row = await reload(intent);
    assert.equal(row.status, 'expired');
  });

  it('CRITICAL: does not expire an executing intent past its TTL — an in-flight ' +
    'physical command must never be reinterpreted as expired', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, {
      status: 'executing',
      expiresAt: new Date(Date.now() - 1000),
      executionStartedAt: new Date(),
    });

    const result = await evaluateOneIntent(intent);
    assert.deepEqual(result, { claimed: false, delivered: false });

    const row = await reload(intent);
    assert.equal(row.status, 'executing', 'TTL must not have moved an executing row');
  });

  it('defense in depth: does not reinterpret an already-terminal intent as expired ' +
    'even if its expiresAt has long since passed', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, {
      status: 'completed',
      expiresAt: new Date(Date.now() - 1000),
      executionCompletedAt: new Date(),
      confidence: 'sent',
    });

    await evaluateOneIntent(intent);

    const row = await reload(intent);
    assert.equal(row.status, 'completed');
  });

  it('a not-yet-expired executing intent is also left untouched (baseline, no regression from the above)', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, {
      status: 'executing',
      expiresAt: new Date(Date.now() + 60000),
      executionStartedAt: new Date(),
    });

    const result = await evaluateOneIntent(intent);
    assert.deepEqual(result, { claimed: false, delivered: false });

    const row = await reload(intent);
    assert.equal(row.status, 'executing');
  });
});

describe('cancelIntent — already-terminal / in-flight intents refuse cancellation', () => {
  it('cancels a real pending intent', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, { status: 'pending' });

    const result = await cancelIntent(intent.id, { id: 1 });
    assert.equal(result.status, 'cancelled');
  });

  it('cancels a real monitoring intent', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, { status: 'monitoring' });

    const result = await cancelIntent(intent.id, { id: 1 });
    assert.equal(result.status, 'cancelled');
  });

  it('refuses to cancel an executing intent with 409 (command delivery in progress)', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, { status: 'executing', executionStartedAt: new Date() });

    await assert.rejects(
      () => cancelIntent(intent.id, { id: 1 }),
      (err) => {
        assert.equal(err.statusCode, 409);
        return true;
      },
    );

    const row = await reload(intent);
    assert.equal(row.status, 'executing', 'a rejected cancel must not have mutated the row');
  });

  it('refuses to cancel an already-completed intent with 400', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, {
      status: 'completed',
      executionCompletedAt: new Date(),
      confidence: 'sent',
    });

    await assert.rejects(
      () => cancelIntent(intent.id, { id: 1 }),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  });

  it('refuses to cancel an already-expired intent with 400', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, { status: 'expired' });

    await assert.rejects(
      () => cancelIntent(intent.id, { id: 1 }),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  });

  it('404s for a nonexistent intent id', async () => {
    await assert.rejects(
      () => cancelIntent('00000000-0000-4000-8000-000000000000', { id: 1 }),
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      },
    );
  });
});

describe('deviceMatchesActiveAssignment', () => {
  it('matches when the claimed device is still the active assignment', () => {
    assert.equal(
      deviceMatchesActiveAssignment({ deviceId: 5 }, { deviceId: 5 }),
      true,
    );
  });

  it('matches across string/number type differences (raw SQL rows vs Sequelize instances)', () => {
    assert.equal(
      deviceMatchesActiveAssignment({ deviceId: '5' }, { deviceId: 5 }),
      true,
    );
  });

  it('does not match when the vehicle was reassigned to a different device after claim', () => {
    assert.equal(
      deviceMatchesActiveAssignment({ deviceId: 5 }, { deviceId: 7 }),
      false,
    );
  });

  it('does not match when there is no active assignment at all', () => {
    assert.equal(deviceMatchesActiveAssignment({ deviceId: 5 }, null), false);
  });
});
