const DUE_SOON_RATIO = 0.1;
const MS_PER_DAY = 86400000;

export function withActionableFlags(computed) {
  const isActionable = !computed.unknown
    && computed.remaining != null
    && (computed.dueSoon || computed.remaining <= 0);
  // Overdue means strictly PAST the due point. Sitting exactly on it is "due now":
  // actionable but not yet overdue, which keeps the Service Due state reachable.
  const isOverdue = !computed.unknown
    && computed.remaining != null
    && computed.remaining < 0;
  return { ...computed, isActionable, isOverdue };
}

/**
 * Next-due math for a maintenance schedule.
 *
 * `start` is the cycle's origin: the odometer (or time) at which the last service
 * was done, or at which the schedule was first configured. The next service is due
 * one `period` later — nextDue = start + period.
 *
 * ONLY completing a service moves `start` (see resetMaintenanceScheduleAfterCompletion
 * in routineServiceTraccarService.js). Passing the due point must never roll the
 * schedule forward to the next multiple: a missed service stays due, and
 * `remaining` goes negative (overdue) until the service is actually completed.
 *
 *   start 5,000 km, period 5,000 km, odometer 10,500 km
 *     -> nextDue 10,000 km, remaining -500 km (overdue)   [not 15,000 / +4,500]
 */
export function computeDue(m, position, odometerFallbackMeters = null) {
  const isTime = typeof m.type === 'string' && m.type.endsWith('Time');
  const start = Number(m.start) || 0;
  const period = Number(m.period) || 0;
  const nextDue = start + period;

  if (isTime) {
    const now = Date.now();
    const remaining = nextDue - now;
    return withActionableFlags({
      ...m,
      isTime,
      nextDue,
      remaining,
      dueSoon: period > 0 && remaining <= period * DUE_SOON_RATIO,
      unknown: false,
    });
  }

  const positionValue = Number(position?.attributes?.[m.type]);
  const fallbackValue = m.type === 'totalDistance' && Number.isFinite(Number(odometerFallbackMeters))
    ? Number(odometerFallbackMeters)
    : NaN;

  // For distance schedules, prefer the higher of live telemetry vs verified odometer.
  // This prevents stale tracker values from immediately re-flagging a just-completed service.
  const current = Number.isFinite(positionValue) && Number.isFinite(fallbackValue)
    ? Math.max(positionValue, fallbackValue)
    : (Number.isFinite(positionValue) ? positionValue : fallbackValue);

  if (!Number.isFinite(current) || period <= 0) {
    return withActionableFlags({
      ...m,
      isTime,
      current: Number.isFinite(current) ? current : null,
      remaining: null,
      dueSoon: false,
      unknown: true,
    });
  }

  const remaining = nextDue - current;
  return withActionableFlags({
    ...m,
    isTime,
    current,
    nextDue,
    remaining,
    dueSoon: remaining <= period * DUE_SOON_RATIO,
    unknown: false,
  });
}

export function classifyDueBucket(computed, now = Date.now()) {
  if (!computed.isActionable || computed.unknown) return null;
  if (computed.isOverdue) return 'overdue';
  if (computed.isTime) {
    const days = computed.remaining / MS_PER_DAY;
    if (days <= 0) return 'dueToday';
    if (days <= 1) return 'dueToday';
    if (days <= 7) return 'dueThisWeek';
    return 'dueSoon';
  }
  // Distance/hours: treat dueSoon as dueThisWeek for KPI bucketing
  if (computed.dueSoon) return 'dueThisWeek';
  return 'scheduled';
}

export function formatRemainingLabel(computed) {
  if (computed.unknown || computed.remaining == null) {
    return 'Awaiting telemetry';
  }
  if (computed.remaining === 0) {
    return 'Due now';
  }
  if (computed.isOverdue) {
    if (computed.isTime) {
      const days = Math.ceil(Math.abs(computed.remaining) / MS_PER_DAY);
      return `${days} day${days === 1 ? '' : 's'} overdue`;
    }
    if (computed.type === 'totalDistance') {
      const km = Math.round(Math.abs(computed.remaining) / 1000);
      return `${km.toLocaleString()} km overdue`;
    }
    return `${Math.round(Math.abs(computed.remaining))} overdue`;
  }
  if (computed.isTime) {
    const days = Math.ceil(computed.remaining / MS_PER_DAY);
    if (days <= 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  }
  if (computed.type === 'totalDistance') {
    const km = Math.round(computed.remaining / 1000);
    return `Due in ${km.toLocaleString()} km`;
  }
  return `Due in ${Math.round(computed.remaining)}`;
}

export function scoreMaintenance(items = []) {
  const actionable = items.filter((i) => i.isActionable);
  const overdue = actionable.filter((i) => i.isOverdue);
  const dueSoon = actionable.filter((i) => !i.isOverdue);
  if (overdue.length > 0) return Math.max(25, 55 - overdue.length * 10);
  if (dueSoon.length > 0) return Math.max(55, 85 - dueSoon.length * 8);
  if (items.length > 0) return 95;
  return null;
}

export function scoreFleetHealth(perVehicleScores) {
  const scores = perVehicleScores.filter((n) => Number.isFinite(n));
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
