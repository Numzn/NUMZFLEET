import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { planDeliveries } from './deliveryPlanner.js';
import { CHANNELS } from '../contracts/notificationContract.js';

const COMPANY_A = '11111111-1111-1111-1111-111111111111';
const COMPANY_B = '22222222-2222-2222-2222-222222222222';

/** Always-eligible recipient, all channels preference-approved — the "everything is fine" baseline every test overrides pieces of. */
function baseDeps(overrides = {}) {
  return {
    checkRecipient: async () => ({ eligible: true }),
    resolvePreferences: async (userId, category, channels) => channels,
    checkChannel: async () => ({ eligible: true }),
    ...overrides,
  };
}

const ORIGINAL_QUIET_ENV = {
  QUIET_HOURS_START: process.env.QUIET_HOURS_START,
  QUIET_HOURS_END: process.env.QUIET_HOURS_END,
  FLEET_TIMEZONE: process.env.FLEET_TIMEZONE,
};
function restoreQuietEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_QUIET_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe('planDeliveries', () => {
  afterEach(restoreQuietEnv);

  it('an enabled channel is planned for delivery', async () => {
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, category: 'system', channels: [CHANNELS.SMS],
    }, baseDeps());
    assert.deepEqual(plan, [{ channel: CHANNELS.SMS, decision: 'deliver', overrideNote: null }]);
  });

  it('a disabled optional channel is suppressed with an explicit, machine-readable reason', async () => {
    const deps = baseDeps({ resolvePreferences: async () => [] }); // nothing survives preference
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, category: 'system', channels: [CHANNELS.SMS],
    }, deps);
    assert.deepEqual(plan, [{ channel: CHANNELS.SMS, decision: 'suppress', reason: 'preference_disabled' }]);
  });

  it('missing phone: SMS is suppressed with no_recipient_phone, not a generic/unexplained failure', async () => {
    const deps = baseDeps({ checkChannel: async () => ({ eligible: false, reason: 'no_recipient_phone' }) });
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, category: 'system', channels: [CHANNELS.SMS],
    }, deps);
    assert.deepEqual(plan, [{ channel: CHANNELS.SMS, decision: 'suppress', reason: 'no_recipient_phone' }]);
  });

  it('missing email: suppressed with no_recipient_email', async () => {
    const deps = baseDeps({ checkChannel: async () => ({ eligible: false, reason: 'no_recipient_email' }) });
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, category: 'system', channels: [CHANNELS.EMAIL],
    }, deps);
    assert.deepEqual(plan, [{ channel: CHANNELS.EMAIL, decision: 'suppress', reason: 'no_recipient_email' }]);
  });

  it('missing push subscription: suppressed with no_subscriptions, not treated as a hard error', async () => {
    const deps = baseDeps({ checkChannel: async () => ({ eligible: false, reason: 'no_subscriptions' }) });
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, category: 'system', channels: [CHANNELS.PUSH],
    }, deps);
    assert.deepEqual(plan, [{ channel: CHANNELS.PUSH, decision: 'suppress', reason: 'no_subscriptions' }]);
  });

  it('invalid recipient/company relationship: every requested channel is safely suppressed, including inbox', async () => {
    const deps = baseDeps({ checkRecipient: async () => ({ eligible: false, reason: 'tenant_mismatch' }) });
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, explicitCompanyId: true, category: 'system',
      channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.SMS, CHANNELS.PUSH],
    }, deps);
    assert.equal(plan.length, 4);
    assert.ok(plan.every((p) => p.decision === 'suppress' && p.reason === 'tenant_mismatch'));
  });

  it('tenant isolation: a genuinely matching company is not suppressed', async () => {
    const deps = baseDeps({
      checkRecipient: async ({ companyId }) => ({ eligible: companyId === COMPANY_A }),
    });
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, explicitCompanyId: true, category: 'system', channels: [CHANNELS.INBOX],
    }, deps);
    assert.equal(plan[0].decision, 'deliver');
  });

  it('multiple channels are each evaluated independently — one suppressed reason never leaks onto a sibling channel', async () => {
    const deps = baseDeps({
      resolvePreferences: async (userId, category, channels) => channels.filter((c) => c !== CHANNELS.EMAIL),
      checkChannel: async (channel) => (channel === CHANNELS.SMS
        ? { eligible: false, reason: 'no_recipient_phone' }
        : { eligible: true }),
    });
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, category: 'system',
      channels: [CHANNELS.INBOX, CHANNELS.SMS, CHANNELS.EMAIL, CHANNELS.PUSH],
    }, deps);
    const byChannel = Object.fromEntries(plan.map((p) => [p.channel, p]));
    assert.equal(byChannel[CHANNELS.INBOX].decision, 'deliver');
    assert.deepEqual(byChannel[CHANNELS.SMS], { channel: CHANNELS.SMS, decision: 'suppress', reason: 'no_recipient_phone' });
    assert.deepEqual(byChannel[CHANNELS.EMAIL], { channel: CHANNELS.EMAIL, decision: 'suppress', reason: 'preference_disabled' });
    assert.equal(byChannel[CHANNELS.PUSH].decision, 'deliver');
  });

  it('a critical-shaped notification does NOT automatically bypass an explicit opt-out — mandatory is the only override, never inferred', async () => {
    const deps = baseDeps({ resolvePreferences: async () => [] });
    // Nothing about this call is "critical" — planDeliveries never even takes a
    // severity — proving the point structurally: there is no code path here
    // that could derive an override from severity even if a caller tried.
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, category: 'security', channels: [CHANNELS.SMS], mandatory: false,
    }, deps);
    assert.equal(plan[0].decision, 'suppress');
    assert.equal(plan[0].reason, 'preference_disabled');
  });

  it('an explicitly mandatory policy CAN override a preference opt-out, and the override is recorded', async () => {
    const deps = baseDeps({ resolvePreferences: async () => [] });
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, category: 'security', channels: [CHANNELS.SMS], mandatory: true,
    }, deps);
    assert.deepEqual(plan, [{
      channel: CHANNELS.SMS, decision: 'deliver', overrideNote: 'mandatory_override:preference_disabled',
    }]);
  });

  it('mandatory never overrides channel eligibility — no policy can conjure a phone number that is not there', async () => {
    const deps = baseDeps({ checkChannel: async () => ({ eligible: false, reason: 'no_recipient_phone' }) });
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, category: 'security', channels: [CHANNELS.SMS], mandatory: true,
    }, deps);
    assert.deepEqual(plan, [{ channel: CHANNELS.SMS, decision: 'suppress', reason: 'no_recipient_phone' }]);
  });

  it('mandatory never overrides recipient eligibility (tenant mismatch, inactive account)', async () => {
    const deps = baseDeps({ checkRecipient: async () => ({ eligible: false, reason: 'recipient_inactive' }) });
    const plan = await planDeliveries({
      userId: 900001, companyId: COMPANY_A, category: 'security', channels: [CHANNELS.SMS], mandatory: true,
    }, deps);
    assert.deepEqual(plan, [{ channel: CHANNELS.SMS, decision: 'suppress', reason: 'recipient_inactive' }]);
  });

  describe('quiet hours', () => {
    beforeEach(() => {
      process.env.FLEET_TIMEZONE = 'Africa/Lusaka';
      process.env.QUIET_HOURS_START = '22:00';
      process.env.QUIET_HOURS_END = '07:00';
    });

    // 23:00 Africa/Lusaka (UTC+2) = 21:00 UTC — inside the configured window.
    const DURING_QUIET_HOURS = new Date('2026-06-15T21:00:00Z');
    // 12:00 Africa/Lusaka = 10:00 UTC — outside it.
    const OUTSIDE_QUIET_HOURS = new Date('2026-06-15T10:00:00Z');

    it('a durable external channel is delayed, not suppressed, with next_attempt_at set to when the window ends', async () => {
      const plan = await planDeliveries({
        userId: 900001, companyId: COMPANY_A, category: 'system', channels: [CHANNELS.SMS], now: DURING_QUIET_HOURS,
      }, baseDeps());
      assert.equal(plan[0].decision, 'delay');
      assert.equal(plan[0].reason, 'quiet_hours_delayed');
      assert.ok(plan[0].nextAttemptAt instanceof Date);
      assert.ok(plan[0].nextAttemptAt.getTime() > DURING_QUIET_HOURS.getTime());
    });

    it('outside the window, the same channel delivers normally', async () => {
      const plan = await planDeliveries({
        userId: 900001, companyId: COMPANY_A, category: 'system', channels: [CHANNELS.SMS], now: OUTSIDE_QUIET_HOURS,
      }, baseDeps());
      assert.equal(plan[0].decision, 'deliver');
    });

    it('in-app (inbox) is never delayed by quiet hours, even alongside a delayed external channel', async () => {
      const plan = await planDeliveries({
        userId: 900001, companyId: COMPANY_A, category: 'system',
        channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.SMS], now: DURING_QUIET_HOURS,
      }, baseDeps());
      const byChannel = Object.fromEntries(plan.map((p) => [p.channel, p]));
      assert.equal(byChannel[CHANNELS.INBOX].decision, 'deliver');
      assert.equal(byChannel[CHANNELS.WEBSOCKET].decision, 'deliver');
      assert.equal(byChannel[CHANNELS.SMS].decision, 'delay');
    });

    it('a mandatory policy explicitly bypasses quiet hours', async () => {
      const plan = await planDeliveries({
        userId: 900001, companyId: COMPANY_A, category: 'system',
        channels: [CHANNELS.SMS], now: DURING_QUIET_HOURS, mandatory: true,
      }, baseDeps());
      assert.equal(plan[0].decision, 'deliver');
    });
  });
});
