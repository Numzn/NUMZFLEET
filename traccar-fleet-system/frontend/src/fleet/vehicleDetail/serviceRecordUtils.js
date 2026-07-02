export const ACTIVE_WORK_ORDER_STATUSES = new Set([
  'open',
  'scheduled',
  'in_progress',
  'awaiting_parts',
]);

export const WORK_ORDER_STATUS_LABELS = {
  open: 'Open',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  awaiting_parts: 'Awaiting parts',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const WORK_ORDER_STATUS_COLORS = {
  open: 'default',
  scheduled: 'default',
  in_progress: 'info',
  awaiting_parts: 'warning',
  completed: 'success',
  cancelled: 'default',
};

/** Status values shown in the manager status dropdown (DTO-facing). */
export const EDITABLE_WORK_ORDER_STATUSES = [
  'scheduled',
  'in_progress',
  'awaiting_parts',
  'completed',
  'cancelled',
];

export function isActiveWorkOrder(record) {
  return ACTIVE_WORK_ORDER_STATUSES.has(record?.status);
}

/** Linked to a Traccar maintenance schedule (routine completion). */
export function isRoutineCompletion(record) {
  return record?.maintenanceId != null;
}

/** Repairs & work orders only — excludes routine service completions (Maintenance tab). */
export function isRepairWorkOrder(record) {
  return !isRoutineCompletion(record);
}

export function filterRepairWorkOrders(records = []) {
  return records.filter(isRepairWorkOrder);
}

function sortKey(record) {
  const iso = record.completedAt || record.createdAt;
  return iso ? new Date(iso).getTime() : 0;
}

export function partitionWorkOrders(records = []) {
  const active = [];
  const history = [];
  for (const record of records) {
    if (isActiveWorkOrder(record)) {
      active.push(record);
    } else {
      history.push(record);
    }
  }
  active.sort((a, b) => sortKey(b) - sortKey(a));
  history.sort((a, b) => sortKey(b) - sortKey(a));
  return { active, history };
}
