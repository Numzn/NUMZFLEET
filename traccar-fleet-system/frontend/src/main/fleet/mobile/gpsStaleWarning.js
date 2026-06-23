/**
 * Returns a GPS stale warning only when fix age exceeds threshold.
 * Hidden when GPS is fresh — reduces noise on the tracking UI.
 */
export function getGpsStaleWarning(fixTime, thresholdMin = 5, now = Date.now()) {
  if (!fixTime) return null;
  const fixMs = new Date(fixTime).getTime();
  if (Number.isNaN(fixMs)) return null;
  const ageMin = (now - fixMs) / 60000;
  if (ageMin <= thresholdMin) return null;
  return `GPS stale (${Math.round(ageMin)} min)`;
}
