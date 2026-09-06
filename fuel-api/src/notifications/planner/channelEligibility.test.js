import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkChannelEligibility } from './channelEligibility.js';
import { CHANNELS } from '../contracts/notificationContract.js';

describe('checkChannelEligibility', () => {
  describe('inbox / websocket — no destination to check', () => {
    it('inbox is always eligible', async () => {
      const result = await checkChannelEligibility(CHANNELS.INBOX, 900001);
      assert.deepEqual(result, { eligible: true });
    });

    it('websocket is always eligible', async () => {
      const result = await checkChannelEligibility(CHANNELS.WEBSOCKET, 900001);
      assert.deepEqual(result, { eligible: true });
    });
  });

  describe('sms', () => {
    it('eligible via metadata.smsTo override, without a DB call (deps never invoked)', async () => {
      const deps = {
        getPhone: async () => { throw new Error('must not be called when smsTo override is present'); },
      };
      const result = await checkChannelEligibility(CHANNELS.SMS, 900001, { smsTo: '+260977123456' }, deps);
      assert.deepEqual(result, { eligible: true });
    });

    it('no_recipient_phone when neither an override nor a profile phone exists', async () => {
      const deps = { getPhone: async () => null };
      const result = await checkChannelEligibility(CHANNELS.SMS, 900001, {}, deps);
      assert.deepEqual(result, { eligible: false, reason: 'no_recipient_phone' });
    });

    it('invalid_phone_number when a phone exists but cannot be normalized', async () => {
      const deps = { getPhone: async () => 'not-a-real-number' };
      const result = await checkChannelEligibility(CHANNELS.SMS, 900001, {}, deps);
      assert.deepEqual(result, { eligible: false, reason: 'invalid_phone_number' });
    });

    it('eligible when the resolved profile phone normalizes cleanly', async () => {
      const deps = { getPhone: async () => '0977123456' };
      const result = await checkChannelEligibility(CHANNELS.SMS, 900001, {}, deps);
      assert.deepEqual(result, { eligible: true });
    });
  });

  describe('email', () => {
    it('eligible via metadata.emailTo override, without a DB call', async () => {
      const deps = {
        findUser: async () => { throw new Error('must not be called when emailTo override is present'); },
      };
      const result = await checkChannelEligibility(CHANNELS.EMAIL, 900001, { emailTo: 'ops@example.com' }, deps);
      assert.deepEqual(result, { eligible: true });
    });

    it('no_recipient_email when there is no numz_users row at all', async () => {
      const deps = { findUser: async () => null };
      const result = await checkChannelEligibility(CHANNELS.EMAIL, 900001, {}, deps);
      assert.deepEqual(result, { eligible: false, reason: 'no_recipient_email' });
    });

    it('invalid_email_address for the numzUserProvisioning.js placeholder domain', async () => {
      const deps = { findUser: async () => ({ email: 'user900001@fleet.local' }) };
      const result = await checkChannelEligibility(CHANNELS.EMAIL, 900001, {}, deps);
      assert.deepEqual(result, { eligible: false, reason: 'invalid_email_address' });
    });

    it('eligible for a real-looking address on file', async () => {
      const deps = { findUser: async () => ({ email: 'ops@example.com' }) };
      const result = await checkChannelEligibility(CHANNELS.EMAIL, 900001, {}, deps);
      assert.deepEqual(result, { eligible: true });
    });
  });

  describe('push — no metadata-override escape hatch, always resolves via numz_users + push_subscriptions', () => {
    it('no_recipient when there is no numz_users row at all', async () => {
      const deps = { findUser: async () => null };
      const result = await checkChannelEligibility(CHANNELS.PUSH, 900001, {}, deps);
      assert.deepEqual(result, { eligible: false, reason: 'no_recipient' });
    });

    it('no_subscriptions when the recipient exists but has zero registered devices', async () => {
      const deps = {
        findUser: async () => ({ id: 'numz-uuid-1' }),
        listSubscriptions: async () => [],
      };
      const result = await checkChannelEligibility(CHANNELS.PUSH, 900001, {}, deps);
      assert.deepEqual(result, { eligible: false, reason: 'no_subscriptions' });
    });

    it('eligible when at least one subscription is registered', async () => {
      const deps = {
        findUser: async () => ({ id: 'numz-uuid-1' }),
        listSubscriptions: async () => [{ id: 'sub-1' }],
      };
      const result = await checkChannelEligibility(CHANNELS.PUSH, 900001, {}, deps);
      assert.deepEqual(result, { eligible: true });
    });
  });

  it('an unrecognized channel fails closed rather than silently passing through', async () => {
    const result = await checkChannelEligibility('carrier-pigeon', 900001);
    assert.deepEqual(result, { eligible: false, reason: 'unknown_channel' });
  });
});
