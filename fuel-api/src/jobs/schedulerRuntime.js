import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';

const isDev = process.env.NODE_ENV === 'development';

async function tryAcquireAdvisoryLock(lockKey, transaction) {
  const rows = await sequelize.query('SELECT pg_try_advisory_lock(:key) AS locked', {
    replacements: { key: lockKey },
    type: QueryTypes.SELECT,
    transaction,
  });
  return rows[0]?.locked === true;
}

async function releaseAdvisoryLock(lockKey, transaction) {
  await sequelize.query('SELECT pg_advisory_unlock(:key)', {
    replacements: { key: lockKey },
    type: QueryTypes.SELECT,
    transaction,
  });
}

/**
 * Starts a recurring background job with the interval/lock/startup-delay
 * boilerplate shared by every scheduler in this directory. Returns a stop
 * function that clears both timers.
 *
 * @param {object} opts
 * @param {string} opts.name — used in log lines, e.g. '[name] ...'
 * @param {number} opts.intervalMs
 * @param {number} [opts.startupDelayMs] — delay before the first tick (default 0 = fire on next event loop turn)
 * @param {number|null} [opts.lockKey] — Postgres advisory lock key from lockKeys.js; omit to run without cross-process locking
 * @param {() => Promise<void>} opts.task — the work to run each tick
 * @param {() => void} [opts.onSkippedInFlight] — called when a tick is skipped because the previous one is still running
 */
export function runIntervalJob({
  name,
  intervalMs,
  startupDelayMs = 0,
  lockKey = null,
  task,
  onSkippedInFlight,
}) {
  let tickInFlight = false;

  const tick = async () => {
    if (tickInFlight) {
      onSkippedInFlight?.();
      return;
    }
    tickInFlight = true;
    // The acquire and release must run on the SAME physical connection:
    // Postgres session-level advisory locks can only be released by the
    // session that took them, and separate sequelize.query() calls can each
    // be handed a different connection from the shared pool. An explicit
    // (unmanaged) transaction pins one connection for both calls without
    // wrapping task() itself in it — task() keeps using the normal pool for
    // its own queries, unchanged.
    let lockAcquired = false;
    let lockTransaction = null;
    try {
      if (lockKey != null) {
        lockTransaction = await sequelize.transaction();
        lockAcquired = await tryAcquireAdvisoryLock(lockKey, lockTransaction);
      } else {
        lockAcquired = true;
      }
      if (!lockAcquired) {
        if (isDev) console.log(`[${name}] tick skipped (advisory lock held)`);
        return;
      }
      await task();
    } catch (err) {
      console.error(`[${name}]`, err?.message || err);
    } finally {
      if (lockTransaction) {
        if (lockAcquired) {
          try {
            await releaseAdvisoryLock(lockKey, lockTransaction);
          } catch (unlockErr) {
            console.error(`[${name}] advisory unlock failed:`, unlockErr?.message || unlockErr);
          }
        }
        await lockTransaction.commit().catch((commitErr) => {
          console.error(`[${name}] lock transaction commit failed:`, commitErr?.message || commitErr);
        });
      }
      tickInFlight = false;
    }
  };

  const startupTimer = setTimeout(() => { void tick(); }, startupDelayMs);
  const intervalId = setInterval(() => { void tick(); }, intervalMs);

  if (isDev) console.log(`[${name}] interval ${intervalMs}ms, first run in ${startupDelayMs}ms`);

  return () => {
    clearTimeout(startupTimer);
    clearInterval(intervalId);
  };
}
