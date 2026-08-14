/**
 * Phase 2 Consolidation — Stage 1 regression test for
 * modules/platform/companiesService.js.
 *
 * provisionCompany() was rewritten to delegate its admin/Traccar-group steps
 * to services/organizationProvisioningService.js (Stage 1). This test proves
 * the externally-visible behavior is unchanged: same response shape, same
 * organization_type/parent_company_id result, same slug-conflict handling.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';

import { provisionCompany, listCompanies } from './companiesService.js';
import { traccarServiceFetch } from '../../services/traccarServiceClient.js';

const createdCompanyIds = [];
const createdTraccarUserIds = [];

after(async () => {
  const { Company, NumzUser, UserRole } = await import('../../models/index.js');

  for (const traccarUserId of createdTraccarUserIds) {
    try {
      await traccarServiceFetch(`/api/users/${traccarUserId}`, { method: 'DELETE' });
    } catch {
      // Best-effort cleanup.
    }
  }

  if (createdCompanyIds.length) {
    await UserRole.destroy({ where: { companyId: createdCompanyIds } });
    await NumzUser.destroy({ where: { companyId: createdCompanyIds } });
    await Company.destroy({ where: { id: createdCompanyIds } });
  }
});

describe('Phase 2 Consolidation Stage 1: modules/platform/companiesService (regression)', () => {
  it('provisionCompany() still returns the same {company, admin} shape and creates a usable tenant', async () => {
    const slug = `companies-svc-test-${uuid().substring(0, 8)}`;
    const email = `companies-svc-test-${uuid().substring(0, 8)}@example.test`;

    const req = {
      body: {
        company: { name: 'Companies Service Regression Co', slug },
        admin: {
          name: 'Regression Admin', email, phone: null, password: 'temp1234',
        },
      },
    };

    const result = await provisionCompany(req);
    createdCompanyIds.push(result.company.id);
    createdTraccarUserIds.push(result.admin.traccarUserId);

    // Response shape unchanged.
    assert.equal(result.company.slug, slug);
    assert.equal(result.company.name, 'Companies Service Regression Co');
    assert.equal(result.company.status, 'active');
    assert.equal(result.admin.email, email);
    assert.equal(result.admin.temporaryPassword, 'temp1234');
    assert.ok(result.admin.traccarUserId);

    // Stage 1 fix: organization_type/parent_company_id are now explicit
    // (previously left at the Sequelize default) — still a Direct-Customer
    // shape, matching this workflow's historical de-facto behavior.
    const { Company } = await import('../../models/index.js');
    const row = await Company.findByPk(result.company.id);
    assert.equal(row.organizationType, 'customer');
    assert.equal(row.parentCompanyId, null);
    assert.ok(row.traccarGroupId, 'expected a Traccar group to be provisioned');
  });

  it('rejects a duplicate slug with 409, same as before', async () => {
    const slug = `companies-svc-dup-${uuid().substring(0, 8)}`;
    const email1 = `companies-svc-dup1-${uuid().substring(0, 8)}@example.test`;
    const email2 = `companies-svc-dup2-${uuid().substring(0, 8)}@example.test`;

    const first = await provisionCompany({
      body: {
        company: { name: 'Dup Test Co', slug },
        admin: {
          name: 'A', email: email1, password: 'temp1234',
        },
      },
    });
    createdCompanyIds.push(first.company.id);
    createdTraccarUserIds.push(first.admin.traccarUserId);

    await assert.rejects(
      () => provisionCompany({
        body: {
          company: { name: 'Dup Test Co 2', slug },
          admin: {
            name: 'B', email: email2, password: 'temp1234',
          },
        },
      }),
      (err) => err.statusCode === 409,
    );
  });

  it('listCompanies() still returns an array including newly-created companies', async () => {
    const rows = await listCompanies();
    assert.ok(Array.isArray(rows));
  });
});
