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
