import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkRecipientEligibility } from './recipientEligibility.js';

const COMPANY_A = '11111111-1111-1111-1111-111111111111';
const COMPANY_B = '22222222-2222-2222-2222-222222222222';

describe('checkRecipientEligibility', () => {
  describe('no numz_users row at all — most of the fleet (Default-Fleet legacy fallback)', () => {
    it('is eligible: absence of provisioning data is not a suppression signal', async () => {
      const deps = { findUser: async () => null };
      const result = await checkRecipientEligibility(
        { traccarUserId: 900001, companyId: COMPANY_A, explicitCompanyId: true },
        deps,
      );
      assert.deepEqual(result, { eligible: true });
    });
  });

  describe('account status', () => {
    it('an active account is eligible', async () => {
      const deps = { findUser: async () => ({ status: 'active', companyId: null }) };
      const result = await checkRecipientEligibility({ traccarUserId: 900001 }, deps);
      assert.deepEqual(result, { eligible: true });
    });

    it('a suspended account is not eligible', async () => {
      const deps = { findUser: async () => ({ status: 'suspended', companyId: null }) };
      const result = await checkRecipientEligibility({ traccarUserId: 900001 }, deps);
      assert.deepEqual(result, { eligible: false, reason: 'recipient_inactive' });
    });

    it('takes priority over a tenant check when both would fail', async () => {
      const deps = { findUser: async () => ({ status: 'suspended', companyId: COMPANY_B }) };
      const result = await checkRecipientEligibility(
        { traccarUserId: 900001, companyId: COMPANY_A, explicitCompanyId: true },
        deps,
      );
      assert.equal(result.reason, 'recipient_inactive');
    });
  });

  describe('tenant/company match — only checked when the caller explicitly scoped this notification', () => {
    it('suppresses a genuine mismatch when explicitCompanyId is true', async () => {
      const deps = { findUser: async () => ({ status: 'active', companyId: COMPANY_B }) };
      const result = await checkRecipientEligibility(
        { traccarUserId: 900001, companyId: COMPANY_A, explicitCompanyId: true },
        deps,
      );
      assert.deepEqual(result, { eligible: false, reason: 'tenant_mismatch' });
    });

    it('is eligible for a genuine match', async () => {
      const deps = { findUser: async () => ({ status: 'active', companyId: COMPANY_A }) };
      const result = await checkRecipientEligibility(
        { traccarUserId: 900001, companyId: COMPANY_A, explicitCompanyId: true },
        deps,
      );
      assert.deepEqual(result, { eligible: true });
    });

    it('is NOT checked when explicitCompanyId is false, even with a real mismatch present', async () => {
      // The DEFAULT_COMPANY_ID-fallback producers (fuel requests, immobilization,
      // tracking, etc.) are not company-scoped today — see recipientEligibility.js's
      // own doc comment and publishNotification.js's explicitCompanyId computation.
      const deps = { findUser: async () => ({ status: 'active', companyId: COMPANY_B }) };
      const result = await checkRecipientEligibility(
        { traccarUserId: 900001, companyId: COMPANY_A, explicitCompanyId: false },
        deps,
      );
      assert.deepEqual(result, { eligible: true });
    });

    it('is NOT checked for a platform-level identity (numz_users.company_id IS NULL)', async () => {
      const deps = { findUser: async () => ({ status: 'active', companyId: null }) };
      const result = await checkRecipientEligibility(
        { traccarUserId: 900001, companyId: COMPANY_A, explicitCompanyId: true },
        deps,
      );
      assert.deepEqual(result, { eligible: true });
    });
  });
});
