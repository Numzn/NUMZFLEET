/**
 * Resolve measured / learned km/L with fallback to configured vehicle spec.
 */
export function resolveFuelEfficiencyDisplay(fuelPerformance, specKmL) {
  const perf = fuelPerformance;
  if (perf?.efficiencySource === 'learned' && perf.kmPerLitre != null && perf.kmPerLitre > 0) {
    const conf = perf.confidence != null ? ` · ${Math.round(perf.confidence)}% confidence` : '';
    return {
      value: perf.kmPerLitre,
      label: `${perf.kmPerLitre.toFixed(1)} km/L`,
      sub: perf.intervalCount ? `Learned from ${perf.intervalCount} refuels${conf}` : `Learned${conf}`,
      source: 'learned',
    };
  }
  if (perf?.measured && perf.kmPerLitre != null && perf.kmPerLitre > 0) {
    const conf = perf.confidence != null ? ` · ${Math.round(perf.confidence)}% confidence` : '';
    return {
      value: perf.kmPerLitre,
      label: `${perf.kmPerLitre.toFixed(1)} km/L`,
      sub: perf.windowDays
        ? `Measured · last ${perf.windowDays} days${conf}`
        : `Measured${conf}`,
      source: 'measured',
    };
  }

  const spec = specKmL != null ? Number(specKmL) : null;
  if (spec != null && spec > 0) {
    return {
      value: spec,
      label: `${spec.toFixed(1)} km/L`,
      sub: 'Configured spec',
      source: 'spec',
    };
  }

  return { value: null, label: '—', sub: null, source: null };
}

export function formatFuelPerformanceDistance(km) {
  if (km == null || !Number.isFinite(Number(km))) return '—';
  return `${Number(km).toLocaleString()} km`;
}

export function formatFuelPerformanceLitres(litres) {
  if (litres == null || !Number.isFinite(Number(litres))) return '—';
  return `${Number(litres).toFixed(1)} L`;
}

export function efficiencySourceLabel(source) {
  if (source === 'learned') return 'Learned from refuels';
  if (source === 'measured') return 'Measured from refuels';
  if (source === 'spec') return 'Configured spec';
  return null;
}
