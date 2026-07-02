import {
  deriveRoutineServiceStatus,
  isRoutineServiceSchedule,
  ROUTINE_SERVICE_LABEL,
} from '../../maintenance/routineServiceStatus.js';

const URGENCY_ORDER = { overdue: 0, dueToday: 1, dueThisWeek: 2, dueSoon: 3 };

function mapLegacyUrgency(schedule) {
  if (schedule?.bucket === 'overdue' || schedule?.isOverdue) return 'overdue';
  if (schedule?.bucket === 'dueToday') return 'due_today';
  if (schedule?.dueSoon || schedule?.bucket === 'dueThisWeek' || schedule?.bucket === 'dueSoon') {
    return 'due_soon';
  }
  return 'scheduled';
}

function buildRoutineNextService(routineSchedule, currentOdometerKm, lastService) {
  const intervalKm = routineSchedule.period != null
    ? Math.round(Number(routineSchedule.period) / 1000)
    : null;

  let nextServiceAtKm = null;
  if (routineSchedule.nextDue != null && Number.isFinite(Number(routineSchedule.nextDue))) {
    nextServiceAtKm = Math.round(Number(routineSchedule.nextDue) / 1000);
  }

  let remainingKm = null;
  if (
    currentOdometerKm != null
    && Number.isFinite(Number(currentOdometerKm))
    && nextServiceAtKm != null
  ) {
    remainingKm = Math.round(nextServiceAtKm - Number(currentOdometerKm));
  } else if (routineSchedule.type === 'totalDistance' && routineSchedule.remaining != null) {
    remainingKm = Math.round(Number(routineSchedule.remaining) / 1000);
  }

  const { status, statusLabel } = deriveRoutineServiceStatus(remainingKm);

  let dueLabel = routineSchedule.remainingLabel;
  if (remainingKm != null && Number.isFinite(remainingKm)) {
    if (remainingKm < 0) {
      dueLabel = `${Math.abs(remainingKm).toLocaleString()} km overdue`;
    } else if (remainingKm === 0) {
      dueLabel = 'Service due now';
    } else {
      dueLabel = `Due in ${remainingKm.toLocaleString()} km`;
    }
  }

  return {
    label: ROUTINE_SERVICE_LABEL,
    name: ROUTINE_SERVICE_LABEL,
    intervalKm,
    currentOdometerKm: currentOdometerKm != null ? Math.round(Number(currentOdometerKm)) : null,
    nextServiceAtKm,
    remainingKm,
    dueLabel,
    status,
    statusLabel,
    urgency: status === 'overdue' ? 'overdue'
      : (status === 'due_now' || status === 'prepare' ? 'due_today'
        : (status === 'due_soon' || status === 'upcoming' ? 'due_soon' : 'scheduled')),
    maintenanceId: routineSchedule.id,
    bucket: routineSchedule.bucket,
    lastService: lastService ?? null,
  };
}

/**
 * @param {object} hub
 * @param {{ odometerKm?: number|null }} [registry]
 */
export function buildMaintenanceEngine(hub, registry = {}) {
  const schedules = hub?.maintenance?.schedules ?? [];
  const kpis = hub?.maintenance?.scheduleKpis ?? {};
  const woSummary = hub?.maintenance?.workOrders?.summary ?? {};
  const lastService = hub?.maintenance?.routineLastService ?? null;
  const currentOdometerKm = registry?.odometerKm ?? null;

  const routineSchedule = schedules.find((s) => isRoutineServiceSchedule(s)) ?? null;

  const actionable = schedules.filter((s) => s.isActionable);
  const sorted = [...actionable].sort((a, b) => {
    const ua = URGENCY_ORDER[a.bucket] ?? 99;
    const ub = URGENCY_ORDER[b.bucket] ?? 99;
    if (ua !== ub) return ua - ub;
    return (a.remaining ?? 0) - (b.remaining ?? 0);
  });

  const legacyNext = sorted[0] || schedules.find((s) => !s.unknown) || null;

  let nextService = null;
  if (routineSchedule) {
    nextService = buildRoutineNextService(routineSchedule, currentOdometerKm, lastService);
  }

  const dueSoonCount = (kpis.dueToday || 0) + (kpis.dueThisWeek || 0) + (kpis.dueSoon || 0)
    + actionable.filter((s) => s.dueSoon && s.bucket !== 'overdue').length;

  return {
    nextService,
    routineServiceConfigured: Boolean(routineSchedule),
    legacyNextService: legacyNext && !routineSchedule
      ? {
        name: legacyNext.name,
        dueLabel: legacyNext.remainingLabel,
        urgency: mapLegacyUrgency(legacyNext),
        remainingKm: legacyNext.type === 'totalDistance' && legacyNext.remaining != null
          ? Math.round(legacyNext.remaining / 1000)
          : null,
        maintenanceId: legacyNext.id,
        bucket: legacyNext.bucket,
      }
      : null,
    overdueCount: routineSchedule && nextService?.status === 'overdue' ? 1 : (kpis.overdue || 0),
    dueSoonCount: routineSchedule && nextService?.status
      && ['upcoming', 'due_soon', 'prepare', 'due_now'].includes(nextService.status)
      ? 1
      : dueSoonCount,
    actionableCount: routineSchedule ? (nextService?.status !== 'on_track' ? 1 : 0) : actionable.length,
    healthScore: hub?.maintenance?.scheduleHealthScore ?? null,
    openWorkOrders: (woSummary.open || 0) + (woSummary.inProgress || 0) + (woSummary.awaitingParts || 0),
  };
}
