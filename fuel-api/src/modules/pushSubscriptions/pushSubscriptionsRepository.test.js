import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sequelize, { NumzUser, PushSubscription, Company } from '../../models/index.js';
import * as repo from './pushSubscriptionsRepository.js';

// Real Postgres — this is genuine table/column behavior (soft-deactivation,
// reactivation-on-resubscribe), not something a mock could prove.
let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

const COMPANY = '00000000-0000-0000-0000-000000000001';
const createdNumzUserIds = [];

async function makeNumzUser() {
  const u = await NumzUser.create({
    companyId: COMPANY,
    email: `push-lifecycle-${randomUUID()}@fleet.local`,
    displayName: 'Push Lifecycle Test',
    traccarUserId: Math.floor(Math.random() * 1_000_000) + 900_000,
    status: 'active',
  });
  createdNumzUserIds.push(u.id);
  return u;
}

after(async () => {
  if (!dbReachable) return;
  await NumzUser.destroy({ where: { id: createdNumzUserIds } });
});

describe('pushSubscriptionsRepository — Phase 6 lifecycle', { skip: !dbReachable }, () => {
  it('a fresh subscription is active and listed', async () => {
    const user = await makeNumzUser();
    const endpoint = `https://push.example.com/${randomUUID()}`;
    await repo.upsertSubscription({
      numzUserId: user.id, endpoint, p256dh: 'k', auth: 'a', userAgent: 'test',
    });
    const list = await repo.listForNumzUser(user.id);
    assert.equal(list.length, 1);
    assert.equal(list[0].status, 'active');
  });

  it('deactivateByEndpoint marks the row inactive rather than deleting it', async () => {
    const user = await makeNumzUser();
    const endpoint = `https://push.example.com/${randomUUID()}`;
    await repo.upsertSubscription({
      numzUserId: user.id, endpoint, p256dh: 'k', auth: 'a', userAgent: 'test',
    });

    const deactivated = await repo.deactivateByEndpoint(endpoint, 'expired');
    assert.equal(deactivated, true);

    // The row still exists — audit history is preserved, not deleted.
    const row = await PushSubscription.findOne({ where: { endpoint } });
    assert.ok(row, 'the row must still exist after deactivation');
    assert.equal(row.status, 'expired');
    assert.equal(row.deactivationReason, 'expired');
    assert.ok(row.deactivatedAt);

    // But it no longer counts as a live destination.
    const list = await repo.listForNumzUser(user.id);
    assert.equal(list.length, 0, 'a dead token must not cause endless future delivery attempts');
  });

  it('deactivateByEndpoint is idempotent — deactivating an already-inactive row is a harmless no-op', async () => {
    const user = await makeNumzUser();
    const endpoint = `https://push.example.com/${randomUUID()}`;
    await repo.upsertSubscription({
      numzUserId: user.id, endpoint, p256dh: 'k', auth: 'a', userAgent: 'test',
    });
    const first = await repo.deactivateByEndpoint(endpoint, 'expired');
    const second = await repo.deactivateByEndpoint(endpoint, 'expired');
    assert.equal(first, true);
    assert.equal(second, false, 'nothing left to transition — no active row matched');
  });

  it('deactivateByEndpoint on an unknown endpoint is a safe no-op, not an error', async () => {
    const result = await repo.deactivateByEndpoint(`https://push.example.com/${randomUUID()}`, 'expired');
    assert.equal(result, false);
  });

  it('re-subscribing on a deactivated endpoint reactivates it — the browser proves it works again by resubscribing', async () => {
    const user = await makeNumzUser();
    const endpoint = `https://push.example.com/${randomUUID()}`;
    await repo.upsertSubscription({
      numzUserId: user.id, endpoint, p256dh: 'k', auth: 'a', userAgent: 'test',
    });
    await repo.deactivateByEndpoint(endpoint, 'expired');
    assert.equal((await repo.listForNumzUser(user.id)).length, 0);

    await repo.upsertSubscription({
      numzUserId: user.id, endpoint, p256dh: 'k2', auth: 'a2', userAgent: 'test-2',
    });
    const list = await repo.listForNumzUser(user.id);
    assert.equal(list.length, 1);
    assert.equal(list[0].status, 'active');
    assert.equal(list[0].deactivatedAt, null);
    assert.equal(list[0].deactivationReason, null);
  });

  it('findByEndpointForNumzUser reports unsubscribed once deactivated, not the stale "still registered" state', async () => {
    const user = await makeNumzUser();
    const endpoint = `https://push.example.com/${randomUUID()}`;
    await repo.upsertSubscription({
      numzUserId: user.id, endpoint, p256dh: 'k', auth: 'a', userAgent: 'test',
    });
    assert.ok(await repo.findByEndpointForNumzUser(user.id, endpoint));

    await repo.deactivateByEndpoint(endpoint, 'expired');
    assert.equal(await repo.findByEndpointForNumzUser(user.id, endpoint), null);
  });

  it('removeForNumzUser (explicit user unsubscribe) still hard-deletes — a deliberate user action, not provider evidence', async () => {
    const user = await makeNumzUser();
    const endpoint = `https://push.example.com/${randomUUID()}`;
    await repo.upsertSubscription({
      numzUserId: user.id, endpoint, p256dh: 'k', auth: 'a', userAgent: 'test',
    });
    await repo.removeForNumzUser(user.id, endpoint);
    const row = await PushSubscription.findOne({ where: { endpoint } });
    assert.equal(row, null, 'a user-initiated unsubscribe removes the row entirely');
  });
});
