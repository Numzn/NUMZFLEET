import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';

const isDev = process.env.NODE_ENV === 'development';

async function tryAcquireAdvisoryLock(lockKey) {
  const rows = await sequelize.query('SELECT pg_try_advisory_lock(:key) AS locked', {
    replacements: { key: lockKey },
    type: QueryTypes.SELECT,
  });
  return rows[0]?.locked === true;
}

async function releaseAdvisoryLock(lockKey) {
  await sequelize.query('SELECT pg_advisory_unlock(:key)', {
    replacements: { key: lockKey },
    type: QueryTypes.SELECT,
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
    let lockAcquired = false;
    try {
      lockAcquired = lockKey == null ? true : await tryAcquireAdvisoryLock(lockKey);
      if (!lockAcquired) {
        if (isDev) console.log(`[${name}] tick skipped (advisory lock held)`);
        return;
      }
      await task();
    } catch (err) {
      console.error(`[${name}]`, err?.message || err);
    } finally {
      if (lockAcquired && lockKey != null) {
        try {
          await releaseAdvisoryLock(lockKey);
        } catch (unlockErr) {
          console.error(`[${name}] advisory unlock failed:`, unlockErr?.message || unlockErr);
        }
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
