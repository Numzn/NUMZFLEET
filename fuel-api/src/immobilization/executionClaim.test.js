/**
 * Real-DB tests for the execution-claim mechanics — Postgres only, no Traccar
 * dependency (these three functions are raw SQL against
 * vehicle_immobilization_intents), so they're safe to run anywhere this
 * suite already runs. Follows the fixture convention used elsewhere in this
 * suite (see vehicleEngine/vehicleEngineService.test.js): real rows created
 * via the Sequelize models, tracked ids, cleaned up in `after`.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { Op } from 'sequelize';
import { v4 as uuid } from 'uuid';
import {
  tryClaimIntentForExecution,
  recordTraccarDeliveryAccepted,
  finalizeExecutingIntent,
} from './executionClaim.js';

const createdVehicleIds = [];
let companyIdPromise = null;

after(async () => {
  const { Vehicle, Company } = await import('../models/index.js');
  if (createdVehicleIds.length) {
    // ON DELETE CASCADE on vehicle_immobilization_intents.vehicleId cleans up intents too.
    await Vehicle.destroy({ where: { id: { [Op.in]: createdVehicleIds } } });
  }
  if (companyIdPromise) {
    const companyId = await companyIdPromise;
    await Company.destroy({ where: { id: companyId } });
  }
});

// Own company row rather than the well-known default company id — that id is
// only guaranteed to exist via a seed migration on a long-lived database, not
// on a freshly-synced one (e.g. CI). Memoized: one company for the whole file.
async function getCompanyId() {
  if (!companyIdPromise) {
    companyIdPromise = (async () => {
      const { Company } = await import('../models/index.js');
      const company = await Company.create({
        slug: `execclaim-test-${uuid().substring(0, 10)}`,
        name: 'ExecClaim Test Co',
        organizationType: 'customer',
        parentCompanyId: null,
        status: 'active',
      });
      return company.id;
    })();
  }
  return companyIdPromise;
}

async function makeVehicle() {
  const { Vehicle } = await import('../models/index.js');
  const vehicle = await Vehicle.create({
    name: `ExecClaim Test Vehicle ${uuid().substring(0, 8)}`,
    companyId: await getCompanyId(),
  });
  createdVehicleIds.push(vehicle.id);
  return vehicle;
}

async function makeIntent(vehicleId, overrides = {}) {
  const { VehicleImmobilizationIntent } = await import('../models/index.js');
  return VehicleImmobilizationIntent.create({
    vehicleId,
    deviceId: 999999, // synthetic id — these tests exercise DB mechanics only, no real device involved
    action: 'immobilize',
    status: 'pending',
    createdByUserId: 1,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    confidence: 'unknown',
    ...overrides,
  });
}

describe('tryClaimIntentForExecution (real DB)', () => {
  it('claims a pending intent and moves it to executing', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id);

    const { claimed, row } = await tryClaimIntentForExecution(intent.id);
    assert.equal(claimed, true);
    assert.equal(row.status, 'executing');
    assert.equal(row.executionAttempt, 1);
    assert.equal(row.deliveryPhase, 'claimed');
    assert.ok(row.executionStartedAt);
  });

  it('claims a monitoring intent the same way', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, { status: 'monitoring' });

    const { claimed, row } = await tryClaimIntentForExecution(intent.id);
    assert.equal(claimed, true);
    assert.equal(row.status, 'executing');
  });

  it('refuses a second claim on an already-executing intent (at most one claim wins)', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id);

    const first = await tryClaimIntentForExecution(intent.id);
    assert.equal(first.claimed, true);

    const second = await tryClaimIntentForExecution(intent.id);
    assert.equal(second.claimed, false);
    assert.equal(second.row, null);
  });

  it('refuses to claim an intent past its TTL, even if still pending', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, {
      expiresAt: new Date(Date.now() - 1000),
    });

    const { claimed } = await tryClaimIntentForExecution(intent.id);
    assert.equal(claimed, false);
  });

  it('refuses to claim an already-terminal intent', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id, { status: 'completed' });

    const { claimed } = await tryClaimIntentForExecution(intent.id);
    assert.equal(claimed, false);
  });
});

describe('recordTraccarDeliveryAccepted (real DB)', () => {
  it('records delivery only while executing', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id);
    await tryClaimIntentForExecution(intent.id);

    const row = await recordTraccarDeliveryAccepted(intent.id, { traccarHttpStatus: 200 });
    assert.ok(row);
    assert.equal(row.status, 'executing');
    assert.equal(row.deliveryPhase, 'http_accepted');
    assert.equal(row.traccarHttpStatus, 200);
    assert.ok(row.traccarDeliveryAt);
  });

  it('is a no-op for an intent that was never claimed (still pending)', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id);

    const row = await recordTraccarDeliveryAccepted(intent.id, { traccarHttpStatus: 200 });
    assert.equal(row, null);
  });

  it('does not overwrite an already-recorded traccarDeliveryAt (idempotent under retry)', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id);
    await tryClaimIntentForExecution(intent.id);

    const first = await recordTraccarDeliveryAccepted(intent.id, { traccarHttpStatus: 200 });
    const firstAt = new Date(first.traccarDeliveryAt).getTime();

    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await recordTraccarDeliveryAccepted(intent.id, { traccarHttpStatus: 200 });
    assert.equal(new Date(second.traccarDeliveryAt).getTime(), firstAt);
  });
});

describe('finalizeExecutingIntent (real DB)', () => {
  it('completes an executing intent', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id);
    await tryClaimIntentForExecution(intent.id);

    const row = await finalizeExecutingIntent(intent.id, {
      status: 'completed',
      confidence: 'sent',
      deliveryPhase: 'http_accepted',
      traccarHttpStatus: 200,
    });
    assert.ok(row);
    assert.equal(row.status, 'completed');
    assert.equal(row.confidence, 'sent');
    assert.ok(row.executionCompletedAt);
  });

  it('fails an executing intent with the given executionError', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id);
    await tryClaimIntentForExecution(intent.id);

    const row = await finalizeExecutingIntent(intent.id, {
      status: 'failed',
      executionError: 'traccar_delivery_unknown_timeout',
      confidence: 'unverified',
      deliveryPhase: 'delivery_unknown',
    });
    assert.equal(row.status, 'failed');
    assert.equal(row.executionError, 'traccar_delivery_unknown_timeout');
    assert.equal(row.confidence, 'unverified');
  });

  it('refuses to finalize an intent that was never claimed (still pending)', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id);

    const row = await finalizeExecutingIntent(intent.id, { status: 'completed', confidence: 'sent' });
    assert.equal(row, null);
  });

  it('cannot be finalized twice — the second call is a no-op, not a second transition', async () => {
    const vehicle = await makeVehicle();
    const intent = await makeIntent(vehicle.id);
    await tryClaimIntentForExecution(intent.id);

    const first = await finalizeExecutingIntent(intent.id, { status: 'completed', confidence: 'sent' });
    assert.equal(first.status, 'completed');

    const second = await finalizeExecutingIntent(intent.id, { status: 'failed', executionError: 'should_not_apply' });
    assert.equal(second, null);

    const { VehicleImmobilizationIntent } = await import('../models/index.js');
    const reloaded = await VehicleImmobilizationIntent.findByPk(intent.id);
    assert.equal(reloaded.status, 'completed');
  });
});
