/**
 * Vehicle Visibility Audit (D1) — reconcileCompanyTraccarUsers's Postgres-side
 * behavior. Does not exercise the live Traccar permission grant itself
 * (ensureUserInCompanyTraccarGroup's traccarServiceFetch call) — that needs a
 * real Traccar admin API round trip, verified manually against the NumzLab
 * dev stack rather than asserted here. This covers the safe no-op path: a
 * company with no Traccar-linked users makes no Traccar calls at all.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';

import { reconcileCompanyTraccarUsers } from './companyProvisioningService.js';

const TEST_SLUG_PREFIX = 'companyprovisioning-';

after(async () => {
  const { Company } = await import('../models/index.js');
  const { Op } = await import('sequelize');
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

describe('reconcileCompanyTraccarUsers', () => {
  it('a company with no numz_users rows is a safe no-op (no Traccar calls attempted)', async () => {
    const company = await makeCompany('No Users Co');
    const result = await reconcileCompanyTraccarUsers(company.id);
    assert.equal(result.usersChecked, 0);
    assert.equal(result.granted, 0);
  });

  it('a falsy companyId is a safe no-op', async () => {
    const result = await reconcileCompanyTraccarUsers(null);
    assert.equal(result.granted, 0);
  });
});
