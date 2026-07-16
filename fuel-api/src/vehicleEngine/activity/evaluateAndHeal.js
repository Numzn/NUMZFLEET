import { evaluateStateTransition } from './vehicleStateEngine.js';

// Only these two issues are actual evidence that the *persisted timestamp*
// itself is wrong, so only these trigger a forced repair attempt.
// stale_telemetry/telemetry_conflict are informational context about current
// telemetry quality — e.g. a vehicle that dropped offline mid-drive will
// always show telemetry_conflict (last-known speed was positive) forever
// after, even though offline/stateEnteredAt are both completely correct.
// Force-rebuilding on those would just re-stamp the same value repeatedly,
// producing no-op "corrections" that pollute the audit trail with noise.
const REPAIR_TRIGGERING_ISSUES = new Set([
  'state_contradicted_by_recent_telemetry',
  'excessive_reconstructed_duration',
]);

/**
 * Single shared orchestration used by every call site that can encounter a
 * vehicle whose persisted row might be wrong: the live webhook, the
 * on-demand read path (GET /api/vehicles), and the periodic/startup
 * reconciliation sweep. Decides whether a health-check-triggered forced
 * repair is needed (an "impossible duration" issue can mean the *state*
 * still happens to match what's persisted but the *timestamp* is wrong —
 * something routine transition-detection alone can never catch), and
 * whether the result counts as a self-healing "correction" worth auditing,
 * as opposed to a routine, expected transition.
 *
 * Routine transitions detected via the live webhook or an on-demand read are
 * NOT corrections — that's the system working as designed, already covered
 * by the existing telemetry.ingest.processed log line and the
 * VEHICLE_STATE_CHANGED domain event. Anything the reconciliation/startup
 * sweep has to fix IS a correction by definition — normal live traffic
 * missed it, which is exactly the "recovery mechanism after crashes,
 * deployments, missed webhook events, or historical bugs" this exists for.
 *
 * A forced repair only ever counts as a correction (and only ever gets
 * audited/persisted as "changed") if it actually produced a different
 * state or timestamp — a repair attempt that lands on the exact same
 * values it started with is a no-op, not a correction.
 *
 * @param {{ vehicleId: string, deviceId: number|null, deviceStatus: string|null,
 *   deviceLastUpdate: string|Date|null, positionSpeed: number|null,
 *   existing: { state: string, stateEnteredAt: Date, stateSource: string }|null,
 *   now?: number }} telemetryRow
 * @param {{ source: 'webhook'|'on_demand'|'reconciliation'|'startup' }} options
 * @returns {Promise<{
 *   state: string, stateEnteredAt: Date, stateSource: string, changed: boolean,
 *   issues: string[], isCorrection: boolean, reason: string|null,
 *   previousState: string|null, previousStateEnteredAt: Date|null,
 * }>}
 */
export async function evaluateAndHeal(telemetryRow, { source }) {
  const { existing } = telemetryRow;
  const previousState = existing?.state ?? null;
  const previousStateEnteredAt = existing?.stateEnteredAt ?? null;

  const initial = await evaluateStateTransition(telemetryRow);
  let result = initial;
  let forcedRepair = false;

  const repairTriggers = (initial.issues || []).filter((i) => REPAIR_TRIGGERING_ISSUES.has(i));
  if (!initial.changed && existing && repairTriggers.length > 0) {
    const rebuilt = await evaluateStateTransition({ ...telemetryRow, forceRebuild: true });
    const actuallyDifferent = rebuilt.state !== previousState
      || rebuilt.stateEnteredAt.getTime() !== new Date(previousStateEnteredAt).getTime();
    if (actuallyDifferent) {
      result = rebuilt;
      forcedRepair = true;
    }
  }

  const isReconciliationSweep = source === 'reconciliation' || source === 'startup';
  const isCorrection = forcedRepair || (isReconciliationSweep && result.changed);

  let reason = null;
  if (forcedRepair) {
    reason = repairTriggers.join(',');
  } else if (isCorrection) {
    reason = previousState == null ? 'first_observation_during_sweep' : 'transition_detected_during_sweep';
  }

  return {
    ...result,
    changed: forcedRepair || result.changed,
    isCorrection,
    reason,
    previousState,
    previousStateEnteredAt,
  };
}
