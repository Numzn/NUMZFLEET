import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { evaluateActiveIntents } from '../services/immobilizationIntentService.js';
import { logImmobilization } from '../immobilization/immobilizationLog.js';

const isDev = process.env.NODE_ENV === 'development';
const IMMOBILIZATION_LOCK_KEY = 84729103;

let tickInFlight = false;

function useAdvisoryLock() {
  const raw = process.env.IMMOBILIZATION_USE_ADVISORY_LOCK;
  if (raw === undefined || raw === '') return true;
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

async function tryAcquireAdvisoryLock() {
  if (!useAdvisoryLock()) return true;
  const rows = await sequelize.query(
    'SELECT pg_try_advisory_lock(:key) AS locked',
    {
      replacements: { key: IMMOBILIZATION_LOCK_KEY },
      type: QueryTypes.SELECT,
    },
  );
  return rows[0]?.locked === true;
}

async function releaseAdvisoryLock() {
  if (!useAdvisoryLock()) return;
  await sequelize.query('SELECT pg_advisory_unlock(:key)', {
    replacements: { key: IMMOBILIZATION_LOCK_KEY },
    type: QueryTypes.SELECT,
  });
}

/**
 * Safety-governed immobilization intent evaluator.
 *
 * Env:
 *   IMMOBILIZATION_EVALUATOR_INTERVAL_MS — tick interval (default 2000). Set 0 to disable.
 *   IMMOBILIZATION_EVALUATOR_STARTUP_DELAY_MS — delay before first tick (default 5000).
 *   IMMOBILIZATION_USE_ADVISORY_LOCK — pg_try_advisory_lock per tick (default on).
 */
export function startImmobilizationEvaluatorScheduler() {
  const raw = process.env.IMMOBILIZATION_EVALUATOR_INTERVAL_MS;
  const intervalMs = raw === undefined || raw === '' ? 2000 : parseInt(raw, 10);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    if (isDev) {
      console.log('[immobilizationEvaluator] disabled (IMMOBILIZATION_EVALUATOR_INTERVAL_MS is 0 or invalid)');
    }
    return () => {};
  }

  const startupDelay = Math.max(
    0,
    parseInt(process.env.IMMOBILIZATION_EVALUATOR_STARTUP_DELAY_MS ?? '5000', 10) || 0,
  );

  const run = async () => {
    if (tickInFlight) {
      logImmobilization('immobilization.evaluator.tick', {
        skippedInFlight: true,
        evaluated: 0,
        claimed: 0,
        delivered: 0,
        durationMs: 0,
      });
      return;
    }

    tickInFlight = true;
    let lockAcquired = false;
    try {
      lockAcquired = await tryAcquireAdvisoryLock();
      if (!lockAcquired) {
        if (isDev) {
          console.log('[immobilizationEvaluator] tick skipped (advisory lock held)');
        }
        return;
      }
      const out = await evaluateActiveIntents();
      if (isDev && out?.executed > 0) {
        console.log('[immobilizationEvaluator] executed', out.executed, 'of', out.evaluated);
      }
    } catch (err) {
      console.error('[immobilizationEvaluator]', err?.message || err);
    } finally {
      if (lockAcquired) {
        try {
          await releaseAdvisoryLock();
        } catch (unlockErr) {
          console.error('[immobilizationEvaluator] advisory unlock failed:', unlockErr?.message || unlockErr);
        }
      }
      tickInFlight = false;
    }
  };

  const startupTimer = setTimeout(() => { void run(); }, startupDelay);
  const intervalId = setInterval(() => { void run(); }, intervalMs);

  if (isDev) {
    console.log(
      `[immobilizationEvaluator] interval ${intervalMs}ms, first run in ${startupDelay}ms`,
    );
  }

  return () => {
    clearTimeout(startupTimer);
    clearInterval(intervalId);
  };
}
