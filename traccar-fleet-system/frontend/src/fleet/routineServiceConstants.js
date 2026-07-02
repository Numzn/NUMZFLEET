/** Informational checklist for Routine Service (v1 — not individually scheduled). */
export const ROUTINE_SERVICE_CHECKLIST = [
  'Engine Oil',
  'Oil Filter',
  'Brake Inspection',
  'Coolant',
  'Battery',
  'Tyres',
  'General Inspection',
];

export const ROUTINE_SERVICE_DEFAULT_INTERVAL_KM = 5000;

export const ROUTINE_SERVICE_LABEL = 'Routine Service';

export const ROUTINE_SERVICE_STATUS_COLORS = {
  on_track: 'success',
  upcoming: 'info',
  due_soon: 'warning',
  prepare: 'warning',
  due_now: 'error',
  overdue: 'error',
};
