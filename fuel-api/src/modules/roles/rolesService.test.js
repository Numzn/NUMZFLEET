/**
 * "A user joins a company" is not a standalone feature in NUMZFLEET today —
 * it happens as a side effect of Team Management assigning that person a
 * role for the first time (see rolesRepository.ensureNumzUserForTraccarId,
 * which refuses to silently reattach a user already provisioned into a
 * different company). This verifies that moment also grants Traccar group
 * access immediately, rather than waiting for an unrelated device
 * assignment to happen to trigger it later.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import { assignRoleToUser } from './rolesService.js';
import { traccarServiceFetch } from '../../services/traccarServiceClient.js';

const TEST_SLUG_PREFIX = 'rolesservice-';
const createdTraccarUserIds = [];

after(async () => {
  const { Company, NumzUser } = await import('../../models/index.js');
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
  const { Company } = await import('../../models/index.js');
  return Company.create({
    id: uuid(),
    slug: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}`,
    name,
    organizationType: 'customer',
    status: 'active',
  });
}

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

describe('assignRoleToUser — a user joining a company gets Traccar group access immediately', () => {
  it('reconciles the company\'s Traccar group as part of assigning a new team member\'s first role', async () => {
    const company = await makeCompany('Join Test Co');
    const tUser = await makeTraccarUser('Join Test User');

    const req = { auth: { companyId: company.id }, body: { traccarUserId: tUser.id, roleKey: 'driver' } };
    await assignRoleToUser(req);

    const { reconcileCompanyTraccarUsers } = await import('../../services/companyProvisioningService.js');
    const followUp = await reconcileCompanyTraccarUsers(company.id);
    assert.equal(followUp.granted, 0, 'assignRoleToUser must already have granted Traccar access — nothing left for a follow-up reconcile to do');
    assert.equal(followUp.revoked, 0);
  });

  it('rejects assigning a role to a user already provisioned into a different company (existing guard, unaffected)', async () => {
    const companyA = await makeCompany('Guard Co A');
    const companyB = await makeCompany('Guard Co B');
    const tUser = await makeTraccarUser('Guard User');

    await assignRoleToUser({ auth: { companyId: companyA.id }, body: { traccarUserId: tUser.id, roleKey: 'driver' } });

    await assert.rejects(
      () => assignRoleToUser({ auth: { companyId: companyB.id }, body: { traccarUserId: tUser.id, roleKey: 'driver' } }),
      (err) => err.statusCode === 409,
    );
  });
});
