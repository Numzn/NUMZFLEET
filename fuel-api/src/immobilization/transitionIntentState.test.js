import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../config/database.js';
import {
  ALLOWED_TRANSITIONS,
  isTransitionAllowed,
  transitionIntentState,
} from './transitionIntentState.js';

describe('transitionIntentState transition rules', () => {
  it('allows only configured lifecycle transitions', () => {
    assert.deepEqual(ALLOWED_TRANSITIONS.pending, ['monitoring', 'executing', 'cancelled', 'expired']);
    assert.deepEqual(ALLOWED_TRANSITIONS.monitoring, ['executing', 'cancelled', 'expired']);
    assert.deepEqual(ALLOWED_TRANSITIONS.executing, ['completed', 'failed']);
    assert.deepEqual(ALLOWED_TRANSITIONS.completed, []);
    assert.deepEqual(ALLOWED_TRANSITIONS.failed, []);
    assert.deepEqual(ALLOWED_TRANSITIONS.expired, []);
    assert.deepEqual(ALLOWED_TRANSITIONS.cancelled, []);
  });

  it('rejects invalid transitions early', () => {
    assert.equal(isTransitionAllowed('executing', 'expired'), false);
    assert.equal(isTransitionAllowed('executing', 'cancelled'), false);
    assert.equal(isTransitionAllowed('monitoring', 'completed'), false);
    assert.equal(isTransitionAllowed('pending', 'monitoring'), true);
  });
});

describe('transitionIntentState guarded SQL behavior', () => {
  it('returns updated row for a valid guarded transition', async () => {
    const originalQuery = sequelize.query;
    let seenSql = '';
    let seenReplacements = null;
    sequelize.query = async (sql, opts) => {
      seenSql = sql;
      seenReplacements = opts?.replacements || null;
      return [{ id: 'intent-1', status: 'cancelled' }];
    };

    try {
      const row = await transitionIntentState({
        id: 'intent-1',
        from: ['pending', 'monitoring'],
        to: 'cancelled',
        patch: { cancelledByUserId: 9 },
      });
      assert.equal(row?.id, 'intent-1');
      assert.equal(row?.status, 'cancelled');
      assert.match(seenSql, /WHERE id = :id/);
      assert.match(seenSql, /status IN \(/);
      assert.equal(seenReplacements?.id, 'intent-1');
      assert.equal(seenReplacements?.to, 'cancelled');
    } finally {
      sequelize.query = originalQuery;
    }
  });

  it('returns null when stale overwrite attempt affects zero rows', async () => {
    const originalQuery = sequelize.query;
    sequelize.query = async () => [];

    try {
      const row = await transitionIntentState({
        id: 'intent-stale',
        from: ['pending', 'monitoring'],
        to: 'expired',
      });
      assert.equal(row, null);
    } finally {
      sequelize.query = originalQuery;
    }
  });

  it('prevents executing from transitioning to expired or cancelled', async () => {
    await assert.rejects(
      () => transitionIntentState({
        id: 'intent-exec',
        from: 'executing',
        to: 'expired',
      }),
      /disallowed transition: executing -> expired/,
    );

    await assert.rejects(
      () => transitionIntentState({
        id: 'intent-exec',
        from: 'executing',
        to: 'cancelled',
      }),
      /disallowed transition: executing -> cancelled/,
    );
  });

  it('supersede race safe: pending/monitoring cancel no-ops after claim to executing', async () => {
    const originalQuery = sequelize.query;
    sequelize.query = async () => [];

    try {
      const row = await transitionIntentState({
        id: 'intent-race',
        from: ['pending', 'monitoring'],
        to: 'cancelled',
        patch: { cancelledByUserId: 42 },
      });
      assert.equal(row, null);
    } finally {
      sequelize.query = originalQuery;
    }
  });
});
