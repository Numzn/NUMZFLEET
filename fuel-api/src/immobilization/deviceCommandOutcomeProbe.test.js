import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { Op } from 'sequelize';
import { v4 as uuid } from 'uuid';
import {
  commandResultLooksLikeAck,
  selectPlausibleAckEvents,
  getAckMatchWindowSec,
  hasCompetingDeliveryBetween,
} from './deviceCommandOutcomeProbe.js';

describe('commandResultLooksLikeAck', () => {
  it('accepts commandResult with empty result', () => {
    assert.equal(commandResultLooksLikeAck({ type: 'commandResult', attributes: {} }, 'engineStop'), true);
  });

  it('rejects explicit failure text', () => {
    assert.equal(
      commandResultLooksLikeAck(
        { type: 'commandResult', attributes: { result: 'Command failed' } },
        'engineStop',
      ),
      false,
    );
  });

  it('accepts engineStop ok-style result', () => {
    assert.equal(
      commandResultLooksLikeAck(
        { type: 'commandResult', attributes: { result: 'STOP OK' } },
        'engineStop',
      ),
      true,
    );
  });

  it('ignores non-commandResult events', () => {
    assert.equal(commandResultLooksLikeAck({ type: 'deviceOnline', attributes: {} }), false);
  });
});

describe('getAckMatchWindowSec', () => {
  it('defaults to 120s', () => {
    const prev = process.env.IMMOBILIZATION_ACK_MATCH_WINDOW_SEC;
    delete process.env.IMMOBILIZATION_ACK_MATCH_WINDOW_SEC;
    try {
      assert.equal(getAckMatchWindowSec(), 120);
    } finally {
      if (prev !== undefined) process.env.IMMOBILIZATION_ACK_MATCH_WINDOW_SEC = prev;
    }
  });
});

describe('selectPlausibleAckEvents — a stray/unrelated commandResult event must not be usable as an ack', () => {
  const delivered = Date.parse('2026-08-20T12:00:00.000Z');

  it('excludes an event that arrived before delivery (cannot be this command\'s result)', () => {
    const events = [{ id: 1, eventtime: new Date(delivered - 5000) }];
    const out = selectPlausibleAckEvents(events, { sinceMs: delivered, matchWindowMs: 120000 });
    assert.deepEqual(out, []);
  });

  it('excludes an event well outside the match window (stray/unrelated commandResult on the same device)', () => {
    const events = [{ id: 1, eventtime: new Date(delivered + 20 * 60 * 1000) }]; // 20 minutes later
    const out = selectPlausibleAckEvents(events, { sinceMs: delivered, matchWindowMs: 120000 }); // 2 minute window
    assert.deepEqual(out, []);
  });

  it('includes an event right at delivery and right at the window edge', () => {
    const events = [
      { id: 1, eventtime: new Date(delivered) },
      { id: 2, eventtime: new Date(delivered + 120000) },
    ];
    const out = selectPlausibleAckEvents(events, { sinceMs: delivered, matchWindowMs: 120000 });
    assert.equal(out.length, 2);
  });

  it('sorts plausible candidates earliest-first — closest to delivery is the strongest candidate, not the most recent', () => {
    const events = [
      { id: 'late', eventtime: new Date(delivered + 90000) },
      { id: 'early', eventtime: new Date(delivered + 5000) },
    ];
    const out = selectPlausibleAckEvents(events, { sinceMs: delivered, matchWindowMs: 120000 });
    assert.deepEqual(out.map((e) => e.id), ['early', 'late']);
  });

  it('ignores events with an unparseable eventtime rather than crashing', () => {
    const events = [{ id: 1, eventtime: 'not-a-date' }];
    const out = selectPlausibleAckEvents(events, { sinceMs: delivered, matchWindowMs: 120000 });
    assert.deepEqual(out, []);
  });

  it('handles an empty/missing event list', () => {
    assert.deepEqual(selectPlausibleAckEvents([], { sinceMs: delivered, matchWindowMs: 120000 }), []);
    assert.deepEqual(selectPlausibleAckEvents(null, { sinceMs: delivered, matchWindowMs: 120000 }), []);
  });
});

describe('hasCompetingDeliveryBetween (real DB) — Traccar gives no command identifier, ' +
  'so a competing command to the same device makes a stray event ambiguous, not ours to claim', () => {
  const createdVehicleIds = [];
  let companyIdPromise = null;

  after(async () => {
    const { Vehicle, Company } = await import('../models/index.js');
    if (createdVehicleIds.length) {
      await Vehicle.destroy({ where: { id: { [Op.in]: createdVehicleIds } } });
    }
    if (companyIdPromise) {
      const companyId = await companyIdPromise;
      await Company.destroy({ where: { id: companyId } });
    }
  });

  // Own company row rather than the well-known default company id — that id
  // is only guaranteed to exist via a seed migration on a long-lived database,
  // not on a freshly-synced one (e.g. CI). Memoized: one company per suite.
  async function getCompanyId() {
    if (!companyIdPromise) {
      companyIdPromise = (async () => {
        const { Company } = await import('../models/index.js');
        const company = await Company.create({
          slug: `ackprobe-test-${uuid().substring(0, 10)}`,
          name: 'AckProbe Test Co',
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
      name: `AckProbe Test Vehicle ${uuid().substring(0, 8)}`,
      companyId: await getCompanyId(),
    });
    createdVehicleIds.push(vehicle.id);
    return vehicle;
  }

  async function makeCompletedIntent(vehicleId, deviceId, traccarDeliveryAt) {
    const { VehicleImmobilizationIntent } = await import('../models/index.js');
    return VehicleImmobilizationIntent.create({
      vehicleId,
      deviceId,
      action: 'immobilize',
      status: 'completed',
      createdByUserId: 1,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      executionStartedAt: traccarDeliveryAt,
      executionCompletedAt: traccarDeliveryAt,
      traccarDeliveryAt,
      confidence: 'sent',
    });
  }

  it('finds no competitor when only one intent was ever delivered to the device', async () => {
    const vehicle = await makeVehicle();
    const deviceId = 888800 + Math.floor(Math.random() * 1000);
    const t0 = Date.now() - 60000;
    const a = await makeCompletedIntent(vehicle.id, deviceId, new Date(t0));

    const competing = await hasCompetingDeliveryBetween(deviceId, a.id, t0, t0 + 30000);
    assert.equal(competing, false);
  });

  it('flags a competing delivery to the same device between the two timestamps', async () => {
    const vehicle = await makeVehicle();
    const deviceId = 888900 + Math.floor(Math.random() * 1000);
    const t0 = Date.now() - 60000;
    const t1 = t0 + 10000; // a second command went out 10s after the first
    const a = await makeCompletedIntent(vehicle.id, deviceId, new Date(t0));
    const b = await makeCompletedIntent(vehicle.id, deviceId, new Date(t1));

    // A stray event arriving at t0+20s is now ambiguous between a and b.
    const competing = await hasCompetingDeliveryBetween(deviceId, a.id, t0, t0 + 20000);
    assert.equal(competing, true, `intent ${b.id}'s delivery at t1 falls inside the window`);
  });

  it('does not flag a delivery to a different device as competing', async () => {
    const vehicle = await makeVehicle();
    const deviceIdA = 889000 + Math.floor(Math.random() * 1000);
    const deviceIdB = deviceIdA + 1;
    const t0 = Date.now() - 60000;
    const a = await makeCompletedIntent(vehicle.id, deviceIdA, new Date(t0));
    await makeCompletedIntent(vehicle.id, deviceIdB, new Date(t0 + 5000));

    const competing = await hasCompetingDeliveryBetween(deviceIdA, a.id, t0, t0 + 20000);
    assert.equal(competing, false);
  });

  it('does not flag a delivery that happened before the window starts', async () => {
    const vehicle = await makeVehicle();
    const deviceId = 889100 + Math.floor(Math.random() * 1000);
    const t0 = Date.now() - 60000;
    const earlier = await makeCompletedIntent(vehicle.id, deviceId, new Date(t0 - 5000));
    const a = await makeCompletedIntent(vehicle.id, deviceId, new Date(t0));
    void earlier;

    const competing = await hasCompetingDeliveryBetween(deviceId, a.id, t0, t0 + 20000);
    assert.equal(competing, false);
  });
});
