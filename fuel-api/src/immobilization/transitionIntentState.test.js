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

describe('exhaustive state machine matrix — every (from, to) pair, not just the ones exercised elsewhere', () => {
  const STATUSES = ['pending', 'monitoring', 'executing', 'completed', 'failed', 'expired', 'cancelled'];
  const TERMINAL = ['completed', 'failed', 'expired', 'cancelled'];

  // The full legal-transition table this module is frozen to (see IMMOBILIZATION.md
  // "State machine (do not add states)"). Written out explicitly rather than
  // re-deriving it from ALLOWED_TRANSITIONS, so a future edit to the table has to
  // consciously change an assertion here too, not just move both in lockstep.
  const LEGAL = new Set([
    'pending->monitoring',
    'pending->executing',
    'pending->cancelled',
    'pending->expired',
    'monitoring->executing',
    'monitoring->cancelled',
    'monitoring->expired',
    'executing->completed',
    'executing->failed',
  ]);

  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const key = `${from}->${to}`;
      const expected = LEGAL.has(key);
      it(`${key} is ${expected ? 'legal' : 'illegal'}`, () => {
        assert.equal(isTransitionAllowed(from, to), expected, key);
      });
    }
  }

  it('every terminal status has zero outbound transitions', () => {
    for (const status of TERMINAL) {
      assert.deepEqual(ALLOWED_TRANSITIONS[status], [], `${status} must be a dead end`);
    }
  });

  it('executing can only resolve to a terminal state, and only completed/failed — ' +
    'critically, expired and cancelled are excluded so a TTL sweep or an operator ' +
    'cancel can never reach into an in-flight physical command', () => {
    assert.deepEqual(ALLOWED_TRANSITIONS.executing, ['completed', 'failed']);
    assert.equal(isTransitionAllowed('executing', 'expired'), false);
    assert.equal(isTransitionAllowed('executing', 'cancelled'), false);
    assert.equal(isTransitionAllowed('executing', 'pending'), false);
    assert.equal(isTransitionAllowed('executing', 'monitoring'), false);
  });

  it('rejects an unknown status on either side rather than treating it as permissive', () => {
    assert.equal(isTransitionAllowed('bogus', 'cancelled'), false);
    assert.equal(isTransitionAllowed('pending', 'bogus'), false);
    assert.equal(isTransitionAllowed('bogus', 'bogus'), false);
  });
});

describe('transitionIntentState rejects any attempt to move a terminal intent, not just executing', () => {
  for (const from of ['completed', 'failed', 'expired', 'cancelled']) {
    it(`throws for ${from} -> cancelled (terminal states are dead ends, not just executing)`, async () => {
      await assert.rejects(
        () => transitionIntentState({ id: 'intent-terminal', from, to: 'cancelled' }),
        new RegExp(`disallowed transition: ${from} -> cancelled`),
      );
    });
  }
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
