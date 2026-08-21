import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Op } from 'sequelize';
import { computeEffectiveStatus, effectivelyActiveWhereClause, EXPIRABLE_STATUSES } from './effectiveStatus.js';

describe('computeEffectiveStatus', () => {
  const now = Date.parse('2026-08-20T22:05:00.000Z');

  it('reports expired for a pending intent past its TTL (evaluator has not swept it yet)', () => {
    const row = { status: 'pending', expiresAt: '2026-08-20T22:00:00.000Z' };
    assert.equal(computeEffectiveStatus(row, now), 'expired');
  });

  it('reports expired for a monitoring intent past its TTL', () => {
    const row = { status: 'monitoring', expiresAt: '2026-08-20T22:00:00.000Z' };
    assert.equal(computeEffectiveStatus(row, now), 'expired');
  });

  it('leaves pending as pending before expiry', () => {
    const row = { status: 'pending', expiresAt: '2026-08-20T22:10:00.000Z' };
    assert.equal(computeEffectiveStatus(row, now), 'pending');
  });

  it('does not reinterpret executing even if expiresAt has passed (claim rows are protected from expiry)', () => {
    const row = { status: 'executing', expiresAt: '2026-08-20T22:00:00.000Z' };
    assert.equal(computeEffectiveStatus(row, now), 'executing');
  });

  it('passes terminal statuses through unchanged regardless of expiresAt', () => {
    for (const status of ['completed', 'failed', 'expired', 'cancelled']) {
      const row = { status, expiresAt: '2026-08-20T22:00:00.000Z' };
      assert.equal(computeEffectiveStatus(row, now), status);
    }
  });

  it('treats a missing expiresAt as not-expired (defensive)', () => {
    const row = { status: 'pending', expiresAt: null };
    assert.equal(computeEffectiveStatus(row, now), 'pending');
  });

  it('returns null for a missing row', () => {
    assert.equal(computeEffectiveStatus(null, now), null);
  });
});

describe('effectivelyActiveWhereClause', () => {
  it('matches executing unconditionally and expirable statuses only while unexpired', () => {
    const nowDate = new Date('2026-08-20T22:05:00.000Z');
    const clause = effectivelyActiveWhereClause(nowDate);
    const orBranches = clause[Op.or];
    assert.equal(orBranches.length, 2);
    assert.deepEqual(orBranches[0], { status: 'executing' });
    assert.deepEqual(orBranches[1], {
      status: { [Op.in]: EXPIRABLE_STATUSES },
      expiresAt: { [Op.gt]: nowDate },
    });
  });

  it('defaults to the current time when no date is supplied', () => {
    const before = Date.now();
    const clause = effectivelyActiveWhereClause();
    const after = Date.now();
    const usedDate = clause[Op.or][1].expiresAt[Op.gt];
    assert.ok(usedDate.getTime() >= before && usedDate.getTime() <= after);
  });
});
