/**
 * Vehicle Visibility Audit — Phase 4, scenarios 1-10 and 12.
 *
 * Named after the real business example this audit was raised against
 * (Default: Toyota Allion; I-TRACK: BOOMER, LIGHT TRUCK, JUKE) but built on
 * synthetic, test-prefixed companies and fake Traccar device ids — never the
 * real production rows. Covers getAccessibleTraccarDeviceIds(), the
 * security-relevant half of the new company-scoped GET /api/fleet/devices
 * endpoint (fleetDeviceSnapshotService.js) that replaces the Dashboard/Live
 * Map's previous direct, unscoped read from Traccar.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import { getAccessibleTraccarDeviceIds } from './fleetDeviceSnapshotService.js';

const TEST_SLUG_PREFIX = 'devicesnapshot-';
let nextDeviceId = 800_000_000 + (Date.now() % 90_000_000);
const freshDeviceId = () => nextDeviceId++;

const createdCompanyDeviceIds = [];

after(async () => {
  const { Company, CompanyDevice } = await import('../models/index.js');
  if (createdCompanyDeviceIds.length) {
    await CompanyDevice.destroy({ where: { id: { [Op.in]: createdCompanyDeviceIds } } });
  }
  await Company.destroy({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
});

async function makeCompany(name) {
  const { Company } = await import('../models/index.js');
  return Company.create({
    id: uuid(),
    slug: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}`,
    name,
    organizationType: 'customer',
    status: 'active',
  });
}

async function claimDevice(companyId, traccarDeviceId) {
  const { CompanyDevice } = await import('../models/index.js');
  const row = await CompanyDevice.create({
    id: uuid(), companyId, traccarDeviceId, isActive: true,
  });
  createdCompanyDeviceIds.push(row.id);
  return row;
}

function customerAuth(companyId) {
  return { activeContext: { type: 'customer', companyId }, accessibleCustomerIds: [] };
}

function platformAuth() {
  return { activeContext: { type: 'platform', companyId: null }, accessibleCustomerIds: [] };
}

describe('Vehicle Visibility Audit — company-scoped device snapshot (D2)', () => {
  it('scenarios 1-4: a Default-company user sees only their own device (Toyota Allion), never I-TRACK\'s (BOOMER, LIGHT TRUCK, JUKE)', async () => {
    const defaultCo = await makeCompany('Default (test)');
    const itrack = await makeCompany('I-TRACK (test)');

    const toyotaAllion = freshDeviceId();
    const boomer = freshDeviceId();
    const lightTruck = freshDeviceId();
    const juke = freshDeviceId();

    await claimDevice(defaultCo.id, toyotaAllion);
    await claimDevice(itrack.id, boomer);
    await claimDevice(itrack.id, lightTruck);
    await claimDevice(itrack.id, juke);

    const ids = await getAccessibleTraccarDeviceIds(customerAuth(defaultCo.id));

    assert.ok(ids.includes(toyotaAllion), 'Default user must see their own vehicle');
    assert.ok(!ids.includes(boomer), 'Default user must not see I-TRACK\'s BOOMER');
    assert.ok(!ids.includes(lightTruck), 'Default user must not see I-TRACK\'s LIGHT TRUCK');
    assert.ok(!ids.includes(juke), 'Default user must not see I-TRACK\'s JUKE');
  });

  it('scenarios 5-8: an I-TRACK user sees BOOMER, LIGHT TRUCK and JUKE, never Default\'s Toyota Allion', async () => {
    const defaultCo = await makeCompany('Default (test) 2');
    const itrack = await makeCompany('I-TRACK (test) 2');

    const toyotaAllion = freshDeviceId();
    const boomer = freshDeviceId();
    const lightTruck = freshDeviceId();
    const juke = freshDeviceId();

    await claimDevice(defaultCo.id, toyotaAllion);
    await claimDevice(itrack.id, boomer);
    await claimDevice(itrack.id, lightTruck);
    await claimDevice(itrack.id, juke);

    const ids = await getAccessibleTraccarDeviceIds(customerAuth(itrack.id));

    assert.ok(ids.includes(boomer), 'I-TRACK user must see BOOMER');
    assert.ok(ids.includes(lightTruck), 'I-TRACK user must see LIGHT TRUCK');
    assert.ok(ids.includes(juke), 'I-TRACK user must see JUKE');
    assert.ok(!ids.includes(toyotaAllion), 'I-TRACK user must not see Default\'s Toyota Allion');
  });

  it('scenario 9: reassigning a device from Default to I-TRACK updates effective visibility both ways', async () => {
    const defaultCo = await makeCompany('Default (test) 3');
    const itrack = await makeCompany('I-TRACK (test) 3');
    const device = freshDeviceId();
    const link = await claimDevice(defaultCo.id, device);

    const before = {
      defaultIds: await getAccessibleTraccarDeviceIds(customerAuth(defaultCo.id)),
      itrackIds: await getAccessibleTraccarDeviceIds(customerAuth(itrack.id)),
    };
    assert.ok(before.defaultIds.includes(device));
    assert.ok(!before.itrackIds.includes(device));

    await link.update({ companyId: itrack.id });

    const after1 = {
      defaultIds: await getAccessibleTraccarDeviceIds(customerAuth(defaultCo.id)),
      itrackIds: await getAccessibleTraccarDeviceIds(customerAuth(itrack.id)),
    };
    assert.ok(!after1.defaultIds.includes(device), 'must disappear from the old company once reassigned');
    assert.ok(after1.itrackIds.includes(device), 'must appear for the new company once reassigned');
  });

  it('scenario 10: reassigning a device from I-TRACK back to Default updates effective visibility both ways', async () => {
    const defaultCo = await makeCompany('Default (test) 4');
    const itrack = await makeCompany('I-TRACK (test) 4');
    const device = freshDeviceId();
    const link = await claimDevice(itrack.id, device);

    await link.update({ companyId: defaultCo.id });

    const defaultIds = await getAccessibleTraccarDeviceIds(customerAuth(defaultCo.id));
    const itrackIds = await getAccessibleTraccarDeviceIds(customerAuth(itrack.id));
    assert.ok(defaultIds.includes(device));
    assert.ok(!itrackIds.includes(device));
  });

  it('scenario 12: a platform administrator\'s snapshot spans every company', async () => {
    const defaultCo = await makeCompany('Default (test) 5');
    const itrack = await makeCompany('I-TRACK (test) 5');
    const toyotaAllion = freshDeviceId();
    const boomer = freshDeviceId();
    await claimDevice(defaultCo.id, toyotaAllion);
    await claimDevice(itrack.id, boomer);

    const ids = await getAccessibleTraccarDeviceIds(platformAuth());

    assert.ok(ids.includes(toyotaAllion));
    assert.ok(ids.includes(boomer));
  });

  it('a company with no claimed devices gets an empty snapshot, not an error', async () => {
    const emptyCo = await makeCompany('Empty (test)');
    const ids = await getAccessibleTraccarDeviceIds(customerAuth(emptyCo.id));
    assert.deepEqual(ids, []);
  });
});
