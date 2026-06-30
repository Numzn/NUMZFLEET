const URGENCY_ORDER = { overdue: 0, dueToday: 1, dueThisWeek: 2, dueSoon: 3 };

export function buildMaintenanceEngine(hub) {
  const schedules = hub?.maintenance?.schedules ?? [];
  const kpis = hub?.maintenance?.scheduleKpis ?? {};
  const woSummary = hub?.maintenance?.workOrders?.summary ?? {};

  const actionable = schedules.filter((s) => s.isActionable);
  const sorted = [...actionable].sort((a, b) => {
    const ua = URGENCY_ORDER[a.bucket] ?? 99;
    const ub = URGENCY_ORDER[b.bucket] ?? 99;
    if (ua !== ub) return ua - ub;
    return (a.remaining ?? 0) - (b.remaining ?? 0);
  });

  const next = sorted[0] || schedules.find((s) => !s.unknown) || null;

  let urgency = 'scheduled';
  if (next?.bucket === 'overdue' || next?.isOverdue) urgency = 'overdue';
  else if (next?.bucket === 'dueToday') urgency = 'due_today';
  else if (next?.dueSoon || next?.bucket === 'dueThisWeek' || next?.bucket === 'dueSoon') urgency = 'due_soon';

  let remainingKm = null;
  if (next?.type === 'totalDistance' && next.remaining != null) {
    remainingKm = Math.round(next.remaining / 1000);
  }

  const dueSoonCount = (kpis.dueToday || 0) + (kpis.dueThisWeek || 0) + (kpis.dueSoon || 0)
    + actionable.filter((s) => s.dueSoon && s.bucket !== 'overdue').length;

  return {
    nextService: next
      ? {
        name: next.name,
        dueLabel: next.remainingLabel,
        urgency,
        remainingKm,
        maintenanceId: next.id,
        bucket: next.bucket,
      }
      : null,
    overdueCount: kpis.overdue || 0,
    dueSoonCount,
    actionableCount: actionable.length,
    healthScore: hub?.maintenance?.scheduleHealthScore ?? null,
    openWorkOrders: (woSummary.open || 0) + (woSummary.inProgress || 0) + (woSummary.awaitingParts || 0),
  };
}
