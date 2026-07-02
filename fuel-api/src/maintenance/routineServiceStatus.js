/** @typedef {'on_track'|'upcoming'|'due_soon'|'prepare'|'due_now'|'overdue'} RoutineServiceStatus */

const STATUS_LABELS = {
  on_track: 'On Track',
  upcoming: 'Upcoming Service',
  due_soon: 'Due Soon',
  prepare: 'Prepare for Service',
  due_now: 'Service Due',
  overdue: 'Overdue',
};

/**
 * Derive Routine Service reminder status from remaining distance (km).
 * @param {number|null|undefined} remainingKm
 * @returns {{ status: RoutineServiceStatus|null, statusLabel: string|null }}
 */
export function deriveRoutineServiceStatus(remainingKm) {
  if (remainingKm == null || !Number.isFinite(Number(remainingKm))) {
    return { status: null, statusLabel: null };
  }
  const km = Number(remainingKm);
  let status;
  if (km < 0) status = 'overdue';
  else if (km === 0) status = 'due_now';
  else if (km <= 100) status = 'prepare';
  else if (km <= 500) status = 'due_soon';
  else if (km <= 1000) status = 'upcoming';
  else status = 'on_track';

  return { status, statusLabel: STATUS_LABELS[status] };
}

export function isRoutineServiceSchedule(schedule) {
  return schedule?.attributes?.numzServicePackage === true;
}

export const ROUTINE_SERVICE_LABEL = 'Routine Service';

export { STATUS_LABELS };
