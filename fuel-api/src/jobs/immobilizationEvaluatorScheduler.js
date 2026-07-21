import { evaluateActiveIntents } from '../services/immobilizationIntentService.js';
import { logImmobilization } from '../immobilization/immobilizationLog.js';
import { runIntervalJob } from './schedulerRuntime.js';
import { LOCK_KEYS } from './lockKeys.js';

const isDev = process.env.NODE_ENV === 'development';

function useAdvisoryLock() {
  const raw = process.env.IMMOBILIZATION_USE_ADVISORY_LOCK;
  if (raw === undefined || raw === '') return true;
  return raw !== '0' && raw.toLowerCase() !== 'false';
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

  const startupDelayMs = Math.max(
    0,
    parseInt(process.env.IMMOBILIZATION_EVALUATOR_STARTUP_DELAY_MS ?? '5000', 10) || 0,
  );

  const task = async () => {
    const out = await evaluateActiveIntents();
    if (isDev && out?.executed > 0) {
      console.log('[immobilizationEvaluator] executed', out.executed, 'of', out.evaluated);
    }
  };

  return runIntervalJob({
    name: 'immobilizationEvaluator',
    intervalMs,
    startupDelayMs,
    lockKey: useAdvisoryLock() ? LOCK_KEYS.IMMOBILIZATION_EVALUATOR : null,
    task,
    onSkippedInFlight: () => {
      logImmobilization('immobilization.evaluator.tick', {
        skippedInFlight: true,
        evaluated: 0,
        claimed: 0,
        delivered: 0,
        durationMs: 0,
      });
    },
  });
}
