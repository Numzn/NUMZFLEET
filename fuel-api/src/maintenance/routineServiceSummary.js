import {
  deriveRoutineServiceStatus,
  isRoutineServiceSchedule,
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
    let remainingKm = null;
    if (item.type === 'totalDistance' && item.remaining != null) {
      remainingKm = Math.round(Number(item.remaining) / 1000);
    }
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
