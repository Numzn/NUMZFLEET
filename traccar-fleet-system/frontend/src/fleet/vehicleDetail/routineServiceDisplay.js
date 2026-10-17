/**
 * Routine Service "how far to go" wording. The backend (`buildRoutineNextService`) words it once —
 * "Due in 1,200 km" / "Service due now" / "250 km overdue" — and every screen shows that string. The derived
 * fallback uses the same words, so a screen that only has the number (an older response) agrees with the rest.
 * (The header used to build `Due in ${remainingKm} km` itself, which read "Due in -250 km" once overdue.)
 */
export function routineDueText(nextService) {
  if (!nextService) return '—';
  if (nextService.dueLabel) return nextService.dueLabel;
  const raw = nextService.remainingKm;
  if (raw == null || raw === '') return '—';
  const km = Number(raw);
  if (!Number.isFinite(km)) return '—';
  if (km < 0) return `${Math.abs(km).toLocaleString()} km overdue`;
  if (km === 0) return 'Service due now';
  return `Due in ${km.toLocaleString()} km`;
}
