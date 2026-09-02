import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectiveChannels } from './effectiveChannelsResolver.js';
import { CHANNELS } from '../contracts/notificationContract.js';

const POLICY_CHANNELS_WITH_EMAIL = [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.EMAIL];
const POLICY_CHANNELS_WITHOUT_EMAIL = [CHANNELS.INBOX, CHANNELS.WEBSOCKET];

function stubDeps({ user, rows }) {
  return {
    findUser: async () => user,
    listPreferences: async () => rows,
  };
}

describe('resolveEffectiveChannels', () => {
  it('is a pure passthrough (no lookup at all) when the policy did not offer email', async () => {
    let called = false;
    const deps = {
      findUser: async () => { called = true; return null; },
      listPreferences: async () => { called = true; return []; },
    };
    const result = await resolveEffectiveChannels(1, 'compliance', POLICY_CHANNELS_WITHOUT_EMAIL, deps);
    assert.deepEqual(result, POLICY_CHANNELS_WITHOUT_EMAIL);
    assert.equal(called, false, 'must not touch the DB when email was never a candidate channel');
  });

  it('drops email (keeps everything else) when userId is null, without any DB call', async () => {
    let called = false;
    const deps = { findUser: async () => { called = true; return null; } };
    const result = await resolveEffectiveChannels(null, 'compliance', POLICY_CHANNELS_WITH_EMAIL, deps);
    assert.deepEqual(result, [CHANNELS.INBOX, CHANNELS.WEBSOCKET]);
    assert.equal(called, false);
  });

  it('drops email when there is no numz_users row for this Traccar user', async () => {
    const deps = stubDeps({ user: null, rows: [] });
    const result = await resolveEffectiveChannels(1, 'compliance', POLICY_CHANNELS_WITH_EMAIL, deps);
    assert.deepEqual(result, [CHANNELS.INBOX, CHANNELS.WEBSOCKET]);
  });

  it('drops email when no preference row exists for this category — the documented safe default, not the shared true default', async () => {
    const deps = stubDeps({ user: { id: 'numz-1' }, rows: [] });
    const result = await resolveEffectiveChannels(1, 'compliance', POLICY_CHANNELS_WITH_EMAIL, deps);
    assert.deepEqual(result, [CHANNELS.INBOX, CHANNELS.WEBSOCKET]);
  });

  it('drops email when the user has explicitly disabled it for this category', async () => {
    const deps = stubDeps({
      user: { id: 'numz-1' },
      rows: [{ channel: 'email', category: 'compliance', enabled: false }],
    });
    const result = await resolveEffectiveChannels(1, 'compliance', POLICY_CHANNELS_WITH_EMAIL, deps);
    assert.deepEqual(result, [CHANNELS.INBOX, CHANNELS.WEBSOCKET]);
  });

  it('keeps email (and everything else) when the user has explicitly enabled it for this category', async () => {
    const deps = stubDeps({
      user: { id: 'numz-1' },
      rows: [{ channel: 'email', category: 'compliance', enabled: true }],
    });
    const result = await resolveEffectiveChannels(1, 'compliance', POLICY_CHANNELS_WITH_EMAIL, deps);
    assert.deepEqual(result, POLICY_CHANNELS_WITH_EMAIL);
  });

  it('is scoped by category — enabling email for "maintenance" must not leak into "compliance"', async () => {
    const deps = stubDeps({
      user: { id: 'numz-1' },
      rows: [{ channel: 'email', category: 'maintenance', enabled: true }],
    });
    const result = await resolveEffectiveChannels(1, 'compliance', POLICY_CHANNELS_WITH_EMAIL, deps);
    assert.deepEqual(result, [CHANNELS.INBOX, CHANNELS.WEBSOCKET]);
  });

  it('never touches inbox/websocket/sms — a policy that also included sms keeps sms regardless of the email decision', async () => {
    const deps = stubDeps({ user: { id: 'numz-1' }, rows: [] });
    const withSms = [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.SMS, CHANNELS.EMAIL];
    const result = await resolveEffectiveChannels(1, 'security', withSms, deps);
    assert.deepEqual(result, [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.SMS]);
  });

  it('fails closed (drops email, keeps other channels) if the preference lookup itself throws', async () => {
    const deps = {
      findUser: async () => { throw new Error('simulated DB failure'); },
    };
    const result = await resolveEffectiveChannels(1, 'compliance', POLICY_CHANNELS_WITH_EMAIL, deps);
    assert.deepEqual(result, [CHANNELS.INBOX, CHANNELS.WEBSOCKET]);
  });

  // --- PUSH (added 2026-09-01) — same gate, same defaults, as EMAIL above ---

  it('drops push (keeps everything else) when no preference row exists — same safe default as email', async () => {
    const deps = stubDeps({ user: { id: 'numz-1' }, rows: [] });
    const withPush = [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.SMS, CHANNELS.PUSH];
    const result = await resolveEffectiveChannels(1, 'security', withPush, deps);
    assert.deepEqual(result, [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.SMS]);
  });

  it('keeps push when the user has explicitly enabled it for this category', async () => {
    const deps = stubDeps({
      user: { id: 'numz-1' },
      rows: [{ channel: 'push', category: 'security', enabled: true }],
    });
    const withPush = [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.SMS, CHANNELS.PUSH];
    const result = await resolveEffectiveChannels(1, 'security', withPush, deps);
    assert.deepEqual(result, withPush);
  });

  // --- Both gated channels present together ---

  it('resolves email and push independently when a policy (hypothetically) carries both', async () => {
    const deps = stubDeps({
      user: { id: 'numz-1' },
      rows: [
        { channel: 'email', category: 'compliance', enabled: true },
        { channel: 'push', category: 'compliance', enabled: false },
      ],
    });
    const both = [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.EMAIL, CHANNELS.PUSH];
    const result = await resolveEffectiveChannels(1, 'compliance', both, deps);
    assert.deepEqual(result, [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.EMAIL]);
  });

  it('a single preference lookup covers both gated channels — does not call listPreferences twice', async () => {
    let listCalls = 0;
    const deps = {
      findUser: async () => ({ id: 'numz-1' }),
      listPreferences: async () => { listCalls += 1; return []; },
    };
    const both = [CHANNELS.INBOX, CHANNELS.EMAIL, CHANNELS.PUSH];
    await resolveEffectiveChannels(1, 'compliance', both, deps);
    assert.equal(listCalls, 1);
  });
});
