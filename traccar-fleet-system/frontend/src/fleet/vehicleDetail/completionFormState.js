/**
 * The completion dialog's odometer field. It starts as the system's own (canonical) odometer, and the
 * system odometer now moves while the dialog is open (live updates). The rule that keeps the service
 * interval honest: the figure that gets recorded — and from which the next interval starts — is the one the
 * person SAW AND CONFIRMED, so a live update may refresh an untouched field but must never replace, or
 * silently re-seed, something they typed.
 */

export function prefillFromOdometer(odometerKm) {
  if (odometerKm == null || odometerKm === '') return '';
  const n = Number(odometerKm);
  return Number.isFinite(n) ? String(Math.round(n)) : '';
}

/**
 * @param {{ current: string, touched: boolean, live: number|string|null|undefined }} state
 * @returns {string} the value the field should now hold
 */
export function odometerFieldValue({ current, touched, live }) {
  if (touched) return current;
  const next = prefillFromOdometer(live);
  return next === '' ? current : next;
}
