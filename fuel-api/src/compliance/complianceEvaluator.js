const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysDiffUtc(target, base) {
  return Math.round((startOfDay(target).getTime() - startOfDay(base).getTime()) / MS_PER_DAY);
}

export function evaluateDueDateStatus({
  dueDate,
  reminderLeadDays = 30,
  now = new Date(),
}) {
  if (!dueDate) {
    return {
      status: 'unknown',
      severity: 'info',
      daysRemaining: null,
    };
  }
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return {
      status: 'unknown',
      severity: 'info',
      daysRemaining: null,
    };
  }

  const daysRemaining = daysDiffUtc(due, now);
  if (daysRemaining < 0) {
    return {
      status: 'overdue',
      severity: 'warning',
      daysRemaining,
    };
  }
  if (daysRemaining === 0) {
    return {
      status: 'due',
      severity: 'warning',
      daysRemaining,
    };
  }
  if (daysRemaining <= Math.max(0, Number(reminderLeadDays) || 0)) {
    return {
      status: 'upcoming',
      severity: 'info',
      daysRemaining,
    };
  }
  return {
    status: 'valid',
    severity: 'info',
    daysRemaining,
  };
}

function evaluateRoutineFromTraccar(nextService = null) {
  if (!nextService?.status || nextService.status === 'on_track') return null;
  if (nextService.status === 'overdue') {
    return {
      source: 'traccar',
      type: 'ROUTINE_SERVICE',
      status: 'overdue',
      severity: 'warning',
      daysRemaining: null,
      remainingKm: nextService.remainingKm ?? null,
      dueDate: null,
      label: nextService.label || 'Routine Service',
    };
  }
  if (nextService.status === 'due_now' || nextService.status === 'prepare') {
    return {
      source: 'traccar',
      type: 'ROUTINE_SERVICE',
      status: 'due',
      severity: 'warning',
      daysRemaining: null,
      remainingKm: nextService.remainingKm ?? null,
      dueDate: null,
      label: nextService.label || 'Routine Service',
    };
  }
  if (nextService.status === 'due_soon' || nextService.status === 'upcoming') {
    return {
      source: 'traccar',
      type: 'ROUTINE_SERVICE',
      status: 'upcoming',
      severity: 'info',
      daysRemaining: null,
      remainingKm: nextService.remainingKm ?? null,
      dueDate: null,
      label: nextService.label || 'Routine Service',
    };
  }
  return null;
}

export function evaluateCompliance({
  fleetVehicleId,
  companyId = null,
  routineNextService = null,
  complianceItems = [],
  now = new Date(),
}) {
  const findings = [];
  const routineFinding = evaluateRoutineFromTraccar(routineNextService);
  if (routineFinding) {
    findings.push({
      ...routineFinding,
      fleetVehicleId,
      companyId,
      complianceId: null,
      reminderLeadDays: null,
      metadata: {},
    });
  }

  for (const item of complianceItems) {
    const evaluated = evaluateDueDateStatus({
      dueDate: item?.dueDate,
      reminderLeadDays: item?.reminderLeadDays,
      now,
    });
    findings.push({
      source: 'vehicle-compliance',
      fleetVehicleId,
      companyId,
      complianceId: item?.id ?? null,
      type: item?.type || 'UNKNOWN',
      status: evaluated.status,
      severity: evaluated.severity,
      dueDate: item?.dueDate || null,
      daysRemaining: evaluated.daysRemaining,
      remainingKm: null,
      reminderLeadDays: item?.reminderLeadDays ?? null,
      documentId: item?.documentId ?? null,
      metadata: item?.metadata && typeof item.metadata === 'object' ? item.metadata : {},
      label: item?.type || 'Compliance',
    });
  }

  return findings;
}
