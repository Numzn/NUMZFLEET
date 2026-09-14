import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Blocking, connection-pinned Postgres advisory lock, keyed by an arbitrary
 * string hashed server-side via hashtext(). Used to serialize concurrent
 * work on the same logical entity (e.g. one vehicle's activity-state
 * evaluation) across independent async call sites — the webhook path and
 * the reconciliation sweep both need to agree that only one of them touches
 * a given vehicle's row at a time.
 *
 * Correctness note (this replaces two independently-broken copies of this
 * pattern that existed in telemetryIngestion.js and
 * vehicleStateReconciliationScheduler.js): pg_advisory_lock()/
 * pg_advisory_unlock() are session-scoped in Postgres — a lock acquired on
 * one connection can only be released by that SAME connection/session, and
 * calling pg_advisory_lock() again on a session that already holds the lock
 * is a same-session re-entrant no-op that returns immediately granted=true.
 * A naive implementation that issues the acquire, the wrapped work, and the
 * release as three independent sequelize.query() calls can have each one
 * handed a different connection from the shared pool (this app's pool has
 * min:0, so connection reuse across "unrelated" concurrent calls is the
 * common case, not an edge case) — which means: the release can silently
 * no-op on a session that never held the lock (leaking it on the original
 * session until that connection idles out of the pool), AND a second,
 * logically-competing caller can "acquire" the same key instantly without
 * ever actually waiting, simply because its query happened to land on the
 * very session that already holds it. Both failure modes defeat mutual
 * exclusion silently — no error, no timeout, just two critical sections
 * quietly interleaving. Confirmed empirically: a concurrent-webhook-events
 * test for the same vehicle produced a non-deterministic final state before
 * this fix (see telemetryIngestion.test.js).
 *
 * The fix (same technique already proven correct in jobs/schedulerRuntime.js
 * for its own, differently-scoped job-level locks): pin the acquire and
 * release to one physical connection via an explicit, unmanaged transaction,
 * while `fn()` keeps using the normal pool for its own queries — task()
 * itself is never wrapped in this transaction, only the lock bracketing it.
 *
 * @param {string} key - hashed via hashtext() server-side; any string is safe as input.
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function withAdvisoryLock(key, fn) {
  const lockTransaction = await sequelize.transaction();
  try {
    await sequelize.query('SELECT pg_advisory_lock(hashtext(:key)::bigint)', {
      replacements: { key }, type: QueryTypes.SELECT, transaction: lockTransaction,
    });
    return await fn();
  } finally {
    try {
      await sequelize.query('SELECT pg_advisory_unlock(hashtext(:key)::bigint)', {
        replacements: { key }, type: QueryTypes.SELECT, transaction: lockTransaction,
      });
    } finally {
      await lockTransaction.commit();
    }
  }
}
