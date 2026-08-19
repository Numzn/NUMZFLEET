/**
 * getVehicleEngine / patchVehicleFields — auth-signature migration regression tests.
 *
 * getVehicleMerged(id, auth) requires a full req.auth object (auth.activeContext is
 * read by canAccessCompany); a bare companyId string has no .activeContext, so
 * canAccessCompany silently returns false and getVehicleMerged returns null. That bug
 * was fixed at 4 call sites in commit ae9696b but left getVehicleEngine,
 * vehicleWorkspaceController's buildOverviewMetrics, and patchVehicleFields broken —
 * the vehicle workspace overview page 404'd and notes/photo saves returned a null
 * body. Nothing in the suite exercised any of this at the time. These tests cover the
 * fix: happy path, cross-company denial, platform-mode and partner->child-customer
 * access (where the *vehicle's* companyId — not the actor's activeContext.companyId —
 * must reach downstream company-scoped lookups), and a lock-in test for the legacy
 * bare-string calling convention.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import { getVehicleEngine } from './vehicleEngineService.js';
import { getEngine } from './vehicleEngineController.js';
import {
  buildOverviewMetrics,
  getOverviewMetrics,
  patchVehicleWorkspaceFields,
  postVehiclePhoto,
} from '../controllers/vehicleWorkspaceController.js';
import { patchVehicleFields } from '../services/vehicleFleetService.js';

const TEST_SLUG_PREFIX = 'veh-engine-auth-';
const createdCompanyIds = [];
const createdVehicleIds = [];

after(async () => {
  const { Company, Vehicle, ServiceRecord } = await import('../models/index.js');
  if (createdVehicleIds.length) {
    await ServiceRecord.destroy({ where: { fleetVehicleId: { [Op.in]: createdVehicleIds } } });
    await Vehicle.destroy({ where: { id: { [Op.in]: createdVehicleIds } } });
  }
  if (createdCompanyIds.length) {
    // Child customers reference parentCompanyId — clear the FK before deleting partners.
    await Company.destroy({ where: { id: { [Op.in]: createdCompanyIds }, parentCompanyId: { [Op.ne]: null } } });
    await Company.destroy({ where: { id: { [Op.in]: createdCompanyIds } } });
  }
});

function slug() {
  return `${TEST_SLUG_PREFIX}${uuid().substring(0, 10)}`;
}

async function makeCompany(overrides = {}) {
  const { Company } = await import('../models/index.js');
  const company = await Company.create({
    slug: slug(),
    name: 'Engine Auth Test Co',
    organizationType: 'customer',
    parentCompanyId: null,
    status: 'active',
    ...overrides,
  });
  createdCompanyIds.push(company.id);
  return company;
}

async function makeVehicle(companyId, overrides = {}) {
  const { Vehicle } = await import('../models/index.js');
  const vehicle = await Vehicle.create({
    name: `Engine Auth Test Vehicle ${uuid().substring(0, 8)}`,
    companyId,
    ...overrides,
  });
  createdVehicleIds.push(vehicle.id);
  return vehicle;
}

async function makeOpenServiceRecord(companyId, fleetVehicleId, title) {
  const { ServiceRecord } = await import('../models/index.js');
  // deprecatedVehicleId is a legacy NOT NULL column (see ServiceRecord.js /
  // serviceRecordService.js's createServiceRecord, which mirrors deviceId into
  // it) — irrelevant to this test's assertions, just needs any non-null int.
  return ServiceRecord.create({
    companyId,
    fleetVehicleId,
    deviceId: 1,
    deprecatedVehicleId: 1,
    title,
    status: 'open',
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

function customerAuth(company) {
  return {
    activeContext: { type: 'customer', companyId: company.id, parentCompanyId: company.parentCompanyId ?? null },
    organizationType: 'customer',
    accessibleCustomerIds: [],
  };
}

function platformAuth() {
  return {
    activeContext: { type: 'platform', companyId: null, parentCompanyId: null },
    organizationType: null,
    accessibleCustomerIds: [],
  };
}

function partnerAuth(partner, accessibleCustomerIds) {
  return {
    activeContext: { type: 'partner', companyId: partner.id, parentCompanyId: null },
    organizationType: 'partner',
    accessibleCustomerIds,
  };
}

/** Matches organizationController.test.js / companyScopeMiddleware.test.js's mock res shape. */
function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

describe('getVehicleEngine / getEngine — auth object required', () => {
  it('company-scoped auth succeeds for its own vehicle', async () => {
    const company = await makeCompany();
    const vehicle = await makeVehicle(company.id);

    const engine = await getVehicleEngine(vehicle.id, customerAuth(company));
    assert.ok(engine, 'getVehicleEngine returned falsy for an in-scope vehicle');
    assert.ok(engine.registry, 'engine snapshot missing registry');

    const req = { params: { id: vehicle.id }, auth: customerAuth(company) };
    const res = mockRes();
    await getEngine(req, res);
    assert.notEqual(res.statusCode, 404, JSON.stringify(res.body));
    assert.ok(res.body, 'getEngine controller returned a null body on the happy path');
  });

  it('cross-company auth is denied (404), not another company\'s data', async () => {
    const companyA = await makeCompany();
    const companyB = await makeCompany();
    const vehicle = await makeVehicle(companyA.id);

    await assert.rejects(
      () => getVehicleEngine(vehicle.id, customerAuth(companyB)),
      (err) => err.statusCode === 404,
    );

    const req = { params: { id: vehicle.id }, auth: customerAuth(companyB) };
    const res = mockRes();
    await getEngine(req, res);
    assert.equal(res.statusCode, 404, JSON.stringify(res.body));
  });

  it('legacy bare-string calling convention still fails closed (regression lock-in)', async () => {
    const company = await makeCompany();
    const vehicle = await makeVehicle(company.id);

    // A raw companyId string has no .activeContext, so canAccessCompany must reject
    // it — this documents that only a full req.auth object grants access, guarding
    // against a future regression back to `req.auth?.companyId`.
    await assert.rejects(
      () => getVehicleEngine(vehicle.id, company.id),
      (err) => err.statusCode === 404,
    );
  });
});

describe('buildOverviewMetrics / getOverviewMetrics — vehicle\'s own companyId, not the actor\'s', () => {
  it('platform-mode auth (activeContext.companyId === null) still resolves the vehicle\'s real company downstream', async () => {
    const company = await makeCompany();
    const vehicle = await makeVehicle(company.id);
    await makeOpenServiceRecord(company.id, vehicle.id, 'Platform-mode next service');

    // If buildOverviewMetrics forwarded auth.activeContext.companyId (null in
    // platform mode) into findNextServiceDue instead of the vehicle's actual
    // companyId, this ServiceRecord would never be found.
    const metrics = await buildOverviewMetrics(vehicle.id, platformAuth());
    assert.ok(metrics.nextService, 'platform-mode read did not find the vehicle\'s own company-scoped service record');
    assert.equal(metrics.nextService.title, 'Platform-mode next service');

    const req = { params: { id: vehicle.id }, auth: platformAuth() };
    const res = mockRes();
    await getOverviewMetrics(req, res);
    assert.notEqual(res.statusCode, 404, JSON.stringify(res.body));
    assert.equal(res.body.nextService?.title, 'Platform-mode next service');
  });

  it('partner viewing a child customer\'s vehicle resolves the child\'s companyId, not the partner\'s own', async () => {
    const partner = await makeCompany({ organizationType: 'partner' });
    const child = await makeCompany({ organizationType: 'customer', parentCompanyId: partner.id });
    const vehicle = await makeVehicle(child.id);
    await makeOpenServiceRecord(child.id, vehicle.id, 'Partner child-customer next service');

    // If this forwarded activeContext.companyId (the partner's own id) instead of
    // the vehicle's real (child) companyId, the ServiceRecord — scoped to the
    // child's companyId — would never be found.
    const metrics = await buildOverviewMetrics(vehicle.id, partnerAuth(partner, [child.id]));
    assert.ok(metrics.nextService, 'partner-mode read did not find the child customer\'s service record');
    assert.equal(metrics.nextService.title, 'Partner child-customer next service');
  });

  it('cross-company auth is denied for the overview endpoint too', async () => {
    const companyA = await makeCompany();
    const companyB = await makeCompany();
    const vehicle = await makeVehicle(companyA.id);

    await assert.rejects(
      () => buildOverviewMetrics(vehicle.id, customerAuth(companyB)),
      (err) => err.statusCode === 404,
    );
  });
});

describe('patchVehicleFields / workspace mutation controllers — auth object required', () => {
  it('company-scoped auth: mutation succeeds and returns the updated vehicle, not null', async () => {
    const company = await makeCompany();
    const vehicle = await makeVehicle(company.id);

    const merged = await patchVehicleFields(vehicle.id, { notes: 'service auth ok' }, customerAuth(company));
    assert.ok(merged, 'patchVehicleFields returned null after a successful mutation');
    assert.equal(merged.notes, 'service auth ok');

    const req = {
      params: { id: vehicle.id },
      auth: customerAuth(company),
      body: { notes: 'controller auth ok' },
    };
    const res = mockRes();
    await patchVehicleWorkspaceFields(req, res);
    assert.ok(res.body, 'patchVehicleWorkspaceFields returned a null body on the happy path');
    assert.equal(res.body.notes, 'controller auth ok');
  });

  it('cross-company auth is denied and the row is left unmodified', async () => {
    const companyA = await makeCompany();
    const companyB = await makeCompany();
    const vehicle = await makeVehicle(companyA.id, { notes: 'original notes' });

    await assert.rejects(
      () => patchVehicleFields(vehicle.id, { notes: 'should never apply' }, customerAuth(companyB)),
      (err) => err.statusCode === 404,
    );

    const { Vehicle } = await import('../models/index.js');
    const fresh = await Vehicle.findByPk(vehicle.id);
    assert.equal(fresh.notes, 'original notes', 'vehicle was mutated despite failing the company-scope gate');
  });

  it('postVehiclePhoto returns the updated vehicle, not null', async () => {
    const company = await makeCompany();
    const vehicle = await makeVehicle(company.id);

    const req = {
      params: { id: vehicle.id },
      auth: customerAuth(company),
      file: { filename: 'engine-auth-test-photo.jpg' },
    };
    const res = mockRes();
    await postVehiclePhoto(req, res);
    assert.ok(res.body, 'postVehiclePhoto returned a null body on the happy path');
    assert.ok(res.body.photoUrl, 'postVehiclePhoto response is missing photoUrl');
  });
});
