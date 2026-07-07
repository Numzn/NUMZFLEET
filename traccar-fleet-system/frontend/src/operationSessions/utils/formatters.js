export function formatLitres(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${v.toFixed(1)} L`;
}

export function formatZmw(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `ZMW ${v.toFixed(0)}`;
}

export function formatZmwPerLitre(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `ZMW ${v.toFixed(2)}/L`;
}

/** "K18,450" — Kwacha shorthand with thousands separators, used across the compact operational screens. */
export function formatK(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `K${Math.round(v).toLocaleString()}`;
}

/**
 * "Tank 60 L" for a manager-verified capacity, "Tank ~60 L" for the generic default
 * fallback — the "~" is the only signal that this number isn't a confirmed measurement.
 */
export function tankLabel(capacityL, source) {
  const v = Number(capacityL);
  if (!Number.isFinite(v) || v <= 0) return null;
  return source === 'verified' ? `Tank ${v} L` : `Tank ~${v} L`;
}
