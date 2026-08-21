/**
 * Organization Controller — admin passthrough tests.
 *
 * organizationService.js's createPartner/createDirectCustomer/
 * createCustomerUnderPartner have been able to provision a real, login-capable
 * admin since Stage 2 (see organizationService.test.js) — but
 * organizationController.js's four handlers only ever destructured
 * `{ name, slug, traccarGroupId }` from req.body, silently dropping `admin`
 * before it ever reached the service. The capability existed and was fully
 * tested at the service layer, but was unreachable from any real HTTP
 * request. routes/organizations.test.js (this file's sibling) never caught
 * this because none of its tests go through the controller at all — they
 * call Company.create() directly.
 *
 * This file tests the controller functions directly (mocked req/res — no
 * supertest or HTTP server in this codebase's test style), hitting the real
 * service/DB/Traccar exactly like organizationService.test.js, so it proves
 * the wiring end-to-end rather than re-testing provisioning logic already
 * covered there.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  createPartnerOrg,
  createDirectCustomerOrg,
  createCustomerUnderPartnerOrg,
  createMyCustomer,
  getMyOverview,
  getContext,
} from './organizationController.js';
import { traccarServiceFetch } from '../services/traccarServiceClient.js';

const TEST_SLUG_PREFIX = 'org-ctrl-admin-';
const createdCompanyIds = [];
const createdTraccarUserIds = [];

after(async () => {
  const { Company, NumzUser, UserRole } = await import('../models/index.js');

  for (const traccarUserId of createdTraccarUserIds) {
    try {
      await traccarServiceFetch(`/api/users/${traccarUserId}`, { method: 'DELETE' });
    } catch {
      // Best-effort cleanup — a stray Traccar test user is low-impact and
      // must not fail the whole suite.
    }
  }

  if (createdCompanyIds.length) {
    await UserRole.destroy({ where: { companyId: createdCompanyIds } });
    await NumzUser.destroy({ where: { companyId: createdCompanyIds } });
    await Company.destroy({
      where: { id: createdCompanyIds, parentCompanyId: { [Op.ne]: null } },
    });
    await Company.destroy({ where: { id: createdCompanyIds } });
  }
});

function slug() {
  return `${TEST_SLUG_PREFIX}${uuid().substring(0, 10)}`;
}

function testAdmin() {
  return {
    name: 'Controller Test Admin',
    email: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}@example.test`,
    password: 'temp1234',
  };
}

/** Minimal mock res — no supertest/HTTP server needed for a controller-level test. */
function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

describe('organizationController — admin passthrough', () => {
  it('createPartnerOrg forwards req.body.admin to the service', async () => {
    const admin = testAdmin();
    const req = { body: { name: 'Ctrl Partner', slug: slug(), admin }, user: { id: 1 } };
    const res = mockRes();

    await createPartnerOrg(req, res);

    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    assert.ok(res.body.admin, 'admin was not forwarded to the service — response has no admin field');
    createdCompanyIds.push(res.body.id);
    createdTraccarUserIds.push(res.body.admin.traccarUserId);
    assert.equal(res.body.admin.email, admin.email);
    assert.equal(res.body.status, 'active');
  });

  it('createDirectCustomerOrg forwards req.body.admin to the service', async () => {
    const admin = testAdmin();
    const req = { body: { name: 'Ctrl Direct Customer', slug: slug(), admin }, user: { id: 1 } };
    const res = mockRes();

    await createDirectCustomerOrg(req, res);

    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    assert.ok(res.body.admin, 'admin was not forwarded to the service');
    createdCompanyIds.push(res.body.id);
    createdTraccarUserIds.push(res.body.admin.traccarUserId);
  });

  it('createCustomerUnderPartnerOrg forwards req.body.admin to the service', async () => {
    const partnerRes = mockRes();
    await createPartnerOrg({ body: { name: 'Ctrl Parent Partner', slug: slug() }, user: { id: 1 } }, partnerRes);
    createdCompanyIds.push(partnerRes.body.id);

    const admin = testAdmin();
    const req = {
      params: { partnerId: partnerRes.body.id },
      body: { name: 'Ctrl Child Customer', slug: slug(), admin },
      user: { id: 1 },
    };
    const res = mockRes();

    await createCustomerUnderPartnerOrg(req, res);

    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    assert.ok(res.body.admin, 'admin was not forwarded to the service');
    createdCompanyIds.push(res.body.id);
    createdTraccarUserIds.push(res.body.admin.traccarUserId);
    assert.equal(res.body.parentCompanyId, partnerRes.body.id);
  });

  it('createMyCustomer (partner self-service) forwards req.body.admin to the service', async () => {
    const partnerRes = mockRes();
    await createPartnerOrg({ body: { name: 'Ctrl Self-Service Partner', slug: slug() }, user: { id: 1 } }, partnerRes);
    createdCompanyIds.push(partnerRes.body.id);

    const admin = testAdmin();
    const req = {
      auth: { activeContext: { type: 'partner', companyId: partnerRes.body.id } },
      body: { name: 'Ctrl Self-Service Customer', slug: slug(), admin },
      user: { id: 1 },
    };
    const res = mockRes();

    await createMyCustomer(req, res);

    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    assert.ok(res.body.admin, 'admin was not forwarded to the service');
    createdCompanyIds.push(res.body.id);
    createdTraccarUserIds.push(res.body.admin.traccarUserId);
  });

  it('admin remains optional — omitting it is still a 201 with no admin field', async () => {
    const req = { body: { name: 'Ctrl No-Admin Partner', slug: slug() }, user: { id: 1 } };
    const res = mockRes();

    await createPartnerOrg(req, res);

    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    createdCompanyIds.push(res.body.id);
    assert.equal(res.body.admin, undefined);
    assert.equal(res.body.status, 'active');
  });

  it('malformed admin input surfaces as 400, not a silent drop or a 500', async () => {
    const req = { body: { name: 'Ctrl Bad Admin', slug: slug(), admin: { name: '', email: 'not-an-email', password: '1' } }, user: { id: 1 } };
    const res = mockRes();

    await createPartnerOrg(req, res);

    // No company should be left behind — organizationService validates admin
    // input before Company.create(), so a bad admin block must not create an
    // orphaned company row.
    assert.equal(res.statusCode, 400, JSON.stringify(res.body));
  });
});

describe('organizationController — getMyOverview', () => {
  it('returns the caller partner\'s own customer count, scoped to just that partner', async () => {
    const partnerRes = mockRes();
    await createPartnerOrg({ body: { name: 'Overview Test Partner', slug: slug() }, user: { id: 1 } }, partnerRes);
    createdCompanyIds.push(partnerRes.body.id);

    const customerA = mockRes();
    await createCustomerUnderPartnerOrg({
      params: { partnerId: partnerRes.body.id },
      body: { name: 'Overview Test Customer A', slug: slug() },
      user: { id: 1 },
    }, customerA);
    createdCompanyIds.push(customerA.body.id);

    const customerB = mockRes();
    await createCustomerUnderPartnerOrg({
      params: { partnerId: partnerRes.body.id },
      body: { name: 'Overview Test Customer B', slug: slug() },
      user: { id: 1 },
    }, customerB);
    createdCompanyIds.push(customerB.body.id);

    const req = { auth: { activeContext: { type: 'partner', companyId: partnerRes.body.id } } };
    const res = mockRes();
    await getMyOverview(req, res);

    assert.equal(res.body.customerCount, 2, JSON.stringify(res.body));
  });

  it('rejects with 401 when there is no active-context companyId', async () => {
    const req = { auth: { activeContext: { type: 'partner', companyId: null } } };
    const res = mockRes();
    await getMyOverview(req, res);

    assert.equal(res.statusCode, 401, JSON.stringify(res.body));
  });
});

describe('organizationController — getContext', () => {
  it('returns a read-only projection of req.auth, not just the active context', async () => {
    const req = {
      auth: {
        activeContext: { type: 'customer', companyId: 'some-company-uuid', companyName: 'Acme' },
        homeCompanyId: 'some-company-uuid',
        isSuperAdmin: true,
        roles: ['super_admin', 'company_admin'],
      },
    };
    const res = mockRes();

    await getContext(req, res);

    assert.equal(res.body.activeContext.type, 'customer');
    assert.equal(res.body.homeCompanyId, 'some-company-uuid');
    assert.equal(res.body.isSuperAdmin, true);
    assert.deepEqual(res.body.roles, ['super_admin', 'company_admin']);
  });

  it('degrades gracefully to empty/null defaults when req.auth is missing', async () => {
    const req = {};
    const res = mockRes();

    await getContext(req, res);

    assert.equal(res.body.activeContext, null);
    assert.equal(res.body.homeCompanyId, null);
    assert.equal(res.body.isSuperAdmin, false);
    assert.deepEqual(res.body.roles, []);
  });
});
