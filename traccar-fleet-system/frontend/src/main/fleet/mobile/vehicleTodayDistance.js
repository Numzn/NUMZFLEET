/** Compact numeric distance for display (no suffix). */
function distanceKmNumber(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  return n;
}

/**
 * Today distance label for live tracking context card.
 * Always prefixed with "Today •" per tracking UX spec.
 */
export function formatTodayDistanceLabel(raw) {
  const n = distanceKmNumber(raw);
  if (n == null) return null;
  if (n <= 0) return 'Today • 0 km';
  if (n >= 100) return `Today • ${Math.round(n)} km`;
  if (n >= 10) return `Today • ${n.toFixed(1)} km`;
  const rounded = Math.round(n * 10) / 10;
  if (Math.abs(rounded - Math.round(n)) < 1e-6) return `Today • ${Math.round(n)} km`;
  return `Today • ${n.toFixed(1)} km`;
}

export function resolveTodayDistanceRaw(position, device) {
  return position?.attributes?.distance ?? device?.attributes?.distance ?? null;
}
