import {
  deriveRoutineServiceStatus,
  isRoutineServiceSchedule,
  routineRemainingKm,
  ROUTINE_SERVICE_LABEL,
} from './routineServiceStatus.js';

/**
 * Build per-vehicle Routine Service summary from company maintenance due state.
 * @param {{ items?: object[] }} dueState
 * @returns {Map<string, object>}
 */
export function buildRoutineServiceSummaryByVehicle(dueState) {
  const map = new Map();
  for (const item of dueState?.items ?? []) {
    if (!item.fleetVehicleId || !isRoutineServiceSchedule(item)) continue;
    const remainingKm = routineRemainingKm(item);
    const { status, statusLabel } = deriveRoutineServiceStatus(remainingKm);
    map.set(String(item.fleetVehicleId), {
      label: ROUTINE_SERVICE_LABEL,
      // Traccar's own tc_maintenances.id — same value maintenanceHub.js's
      // mapSchedule() calls maintenanceId. Needed by anything that must
      // reference this specific schedule (e.g. notifyRoutineServiceState).
      maintenanceId: item.id ?? null,
      status,
      statusLabel,
      remainingKm,
      nextServiceAtKm: item.nextDue != null ? Math.round(Number(item.nextDue) / 1000) : null,
      // Where the current interval started: Traccar's schedule `start`, which completing a service rebases.
      // This (not the cached numzFleetConfig copy, which is only written at setup) is the true baseline, so a
      // screen that re-saves Routine Service can never rewind the interval to a stale figure. null when the
      // schedule carries no usable start; a genuine 0 is a real first-cycle value.
      startingOdometerKm: item.start != null && item.start !== '' && Number.isFinite(Number(item.start))
        ? Math.round(Number(item.start) / 1000)
        : null,
      // Authoritative interval (Traccar schedule period), not the cached
      // numzFleetConfig pointer — lets readiness/UI stop trusting the cache.
      intervalKm: item.period != null ? Math.round(Number(item.period) / 1000) : null,
      dueLabel: item.remainingLabel ?? null,
    });
  }
  return map;
}

export function isActionableRoutineStatus(status) {
  return status != null && status !== 'on_track';
}
