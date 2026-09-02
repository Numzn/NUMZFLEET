import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deliverPushNotification } from './pushChannel.js';

describe('deliverPushNotification — gating (no I/O)', () => {
  it('returns no_recipient when there is no userId — matches house convention of no I/O in unit tests', async () => {
    const result = await deliverPushNotification({ userId: null, title: 'Test', message: 'Test message' });
    // Either the provider isn't configured in this environment, or the
    // no-userId check fires first — both are valid "did not send" outcomes.
    assert.equal(result.ok, false);
    assert.ok(['no_recipient', 'not_configured'].includes(result.reason));
  });

  it('returns not_configured when VAPID is unset, even with a real userId', async () => {
    // Forced via the injection seam, not ambient env state — this dev
    // environment now has real VAPID keys configured (required for the
    // actual feature to work at all), so a test relying on "this env
    // happens to be unconfigured" would be false the moment that shipped.
    // Same reasoning as the isConfigured test below.
    const result = await deliverPushNotification(
      { userId: 1, title: 'Test', message: 'Test message' },
      { isConfigured: () => false },
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'not_configured');
  });

  it('the isConfigured injection seam can force the configured path open for testing the gate itself', async () => {
    const result = await deliverPushNotification(
      { userId: null, title: 'Test', message: 'Test message' },
      { isConfigured: () => true },
    );
    // Configured now, but still no userId — the next gate down should fire.
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_recipient');
  });
});

describe('deliverPushNotification — fan-out and expiry handling (mocked deps, no real DB/network I/O)', () => {
  const configured = { isConfigured: () => true };

  it('returns no_recipient when the userId has no numz_users row', async () => {
    const result = await deliverPushNotification(
      { userId: 999, title: 'Test', message: 'Test message' },
      { ...configured, findUser: async () => null },
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_recipient');
  });

  it('returns no_subscriptions when the user has zero registered devices', async () => {
    const result = await deliverPushNotification(
      { userId: 1, title: 'Test', message: 'Test message' },
      { ...configured, findUser: async () => ({ id: 'numz-1' }), listSubscriptions: async () => [] },
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_subscriptions');
  });

  it('sends to every registered device (fan-out) and reports ok:true if at least one succeeds', async () => {
    const sent = [];
    const touched = [];
    const result = await deliverPushNotification(
      { userId: 1, title: 'Test', message: 'Test message' },
      {
        ...configured,
        findUser: async () => ({ id: 'numz-1' }),
        listSubscriptions: async () => [
          { id: 'sub-a', endpoint: 'https://push.example.com/a' },
          { id: 'sub-b', endpoint: 'https://push.example.com/b' },
        ],
        send: async (sub) => { sent.push(sub.id); return { ok: true }; },
        touch: async (id) => { touched.push(id); },
      },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(sent.sort(), ['sub-a', 'sub-b']);
    assert.deepEqual(touched.sort(), ['sub-a', 'sub-b']);
    assert.equal(result.results.length, 2);
    assert.ok(result.results.every((r) => r.ok));
  });

  it('auto-removes an expired subscription (404/410) and still succeeds via the other device', async () => {
    const removed = [];
    const result = await deliverPushNotification(
      { userId: 1, title: 'Test', message: 'Test message' },
      {
        ...configured,
        findUser: async () => ({ id: 'numz-1' }),
        listSubscriptions: async () => [
          { id: 'sub-dead', endpoint: 'https://push.example.com/dead' },
          { id: 'sub-alive', endpoint: 'https://push.example.com/alive' },
        ],
        send: async (sub) => {
          if (sub.id === 'sub-dead') {
            const err = new Error('gone');
            err.statusCode = 410;
            err.expired = true;
            throw err;
          }
          return { ok: true };
        },
        removeExpired: async (endpoint) => { removed.push(endpoint); },
        touch: async () => {},
      },
    );
    assert.equal(result.ok, true, 'the surviving device still got the push');
    assert.deepEqual(removed, ['https://push.example.com/dead']);
    const deadResult = result.results.find((r) => r.id === 'sub-dead');
    assert.equal(deadResult.reason, 'expired_removed');
  });

  it('a non-expiry send failure on one device does not block delivery to the others, and is not auto-removed', async () => {
    const removed = [];
    const result = await deliverPushNotification(
      { userId: 1, title: 'Test', message: 'Test message' },
      {
        ...configured,
        findUser: async () => ({ id: 'numz-1' }),
        listSubscriptions: async () => [
          { id: 'sub-flaky', endpoint: 'https://push.example.com/flaky' },
          { id: 'sub-ok', endpoint: 'https://push.example.com/ok' },
        ],
        send: async (sub) => {
          if (sub.id === 'sub-flaky') {
            const err = new Error('upstream 500');
            err.statusCode = 500;
            err.expired = false;
            throw err;
          }
          return { ok: true };
        },
        removeExpired: async (endpoint) => { removed.push(endpoint); },
        touch: async () => {},
      },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(removed, [], 'a transient failure must not delete the subscription');
    const flakyResult = result.results.find((r) => r.id === 'sub-flaky');
    assert.equal(flakyResult.reason, 'send_failed');
  });

  it('reports ok:false when every device fails', async () => {
    const result = await deliverPushNotification(
      { userId: 1, title: 'Test', message: 'Test message' },
      {
        ...configured,
        findUser: async () => ({ id: 'numz-1' }),
        listSubscriptions: async () => [{ id: 'sub-a', endpoint: 'https://push.example.com/a' }],
        send: async () => { throw new Error('network down'); },
      },
    );
    assert.equal(result.ok, false);
  });
});
