/**
 * reconcileCompanyTraccarUsers — grant AND revoke, verified against real dev
 * Traccar (not mocked). Creates and deletes real, disposable Traccar users
 * and groups scoped to this test file only; never touches any pre-existing
 * Traccar account or group. This is the mechanism behind "permissions must
 * also be revoked when appropriate" — a user leaving a company (or being
 * deactivated) must lose that company's Traccar group membership, not just
 * never gain a new one.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import { reconcileCompanyTraccarUsers } from './companyProvisioningService.js';
import { traccarServiceFetch } from './traccarServiceClient.js';

const TEST_SLUG_PREFIX = 'companyprovisioning-';
const createdTraccarUserIds = [];

// CI's quality-checks job has no Traccar service/credentials — only the dev
// stack has a real Traccar reachable (see organizationProvisioningService.test.js
// for the established pattern this matches). Every test here is meaningless
// without it, so skip the whole suite there rather than individual cases.
const SKIP_NO_TRACCAR = (process.env.TRACCAR_API_USER && process.env.TRACCAR_API_PASSWORD)
  ? false
  : 'requires a live Traccar (TRACCAR_API_USER/TRACCAR_API_PASSWORD not set) — not available in CI yet';

after(async () => {
  const { Company, NumzUser } = await import('../models/index.js');
  const companies = await Company.findAll({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  await NumzUser.destroy({ where: { email: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  await Company.destroy({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  for (const company of companies) {
    if (company.traccarGroupId) {
      await traccarServiceFetch(`/api/groups/${company.traccarGroupId}`, { method: 'DELETE' }).catch(() => {});
    }
  }
  for (const id of createdTraccarUserIds) {
    await traccarServiceFetch(`/api/users/${id}`, { method: 'DELETE' }).catch(() => {});
  }
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

/** Real, disposable Traccar user — /api/permissions has an FK on tc_users, so a fake id would 500. */
async function makeTraccarUser(label) {
  const email = `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}@test.local`;
  const user = await traccarServiceFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({
      name: label, email, password: 'TestPass123!', administrator: false,
    }),
  });
  createdTraccarUserIds.push(user.id);
  return user;
}

async function makeNumzUser(companyId, traccarUserId, status = 'active') {
  const { NumzUser } = await import('../models/index.js');
  return NumzUser.create({
    id: uuid(),
    companyId,
    traccarUserId,
    email: `${TEST_SLUG_PREFIX}${traccarUserId}@test.local`,
    status,
  });
}

describe('reconcileCompanyTraccarUsers', { skip: SKIP_NO_TRACCAR }, () => {
  it('grants group membership to an active, Traccar-linked user, and is idempotent', async () => {
    const company = await makeCompany('Grant Test Co');
    const tUser = await makeTraccarUser('Grant Test User');
    await makeNumzUser(company.id, tUser.id);

    const first = await reconcileCompanyTraccarUsers(company.id);
    assert.equal(first.granted, 1);
    assert.equal(first.revoked, 0);

    const second = await reconcileCompanyTraccarUsers(company.id);
    assert.equal(second.granted, 0, 'already-granted membership must not be re-granted');
    assert.equal(second.revoked, 0);
  });

  it('revokes group membership once the user is deactivated (leaves the company)', async () => {
    const company = await makeCompany('Revoke Test Co');
    const tUser = await makeTraccarUser('Revoke Test User');
    const numzUser = await makeNumzUser(company.id, tUser.id);

    const granted = await reconcileCompanyTraccarUsers(company.id);
    assert.equal(granted.granted, 1);

    await numzUser.update({ status: 'inactive' });

    const revoked = await reconcileCompanyTraccarUsers(company.id);
    assert.equal(revoked.revoked, 1, 'stale membership must be revoked once the user is no longer active');
    assert.equal(revoked.granted, 0);
  });

  it('revokes group membership once the user moves to a different company', async () => {
    const companyA = await makeCompany('Move From Co');
    const companyB = await makeCompany('Move To Co');
    const tUser = await makeTraccarUser('Mover User');
    const numzUser = await makeNumzUser(companyA.id, tUser.id);

    await reconcileCompanyTraccarUsers(companyA.id);

    await numzUser.update({ companyId: companyB.id });

    const revokedFromA = await reconcileCompanyTraccarUsers(companyA.id);
    assert.equal(revokedFromA.revoked, 1, 'must lose access to the old company\'s group');

    const grantedToB = await reconcileCompanyTraccarUsers(companyB.id);
    assert.equal(grantedToB.granted, 1, 'must gain access to the new company\'s group');
  });

  it('a company with no Traccar-linked users is a safe no-op', async () => {
    const company = await makeCompany('No Users Co');
    const result = await reconcileCompanyTraccarUsers(company.id);
    assert.equal(result.granted, 0);
    assert.equal(result.revoked, 0);
  });

  it('a falsy companyId is a safe no-op', async () => {
    const result = await reconcileCompanyTraccarUsers(null);
    assert.equal(result.granted, 0);
  });
});
