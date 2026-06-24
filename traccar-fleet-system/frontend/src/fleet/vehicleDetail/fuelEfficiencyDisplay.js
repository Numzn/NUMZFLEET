/**
 * Resolve measured km/L (from operation refuels) with fallback to configured vehicle spec.
 */
export function resolveFuelEfficiencyDisplay(fuelPerformance, specKmL) {
  const perf = fuelPerformance;
  if (perf?.measured && perf.kmPerLitre != null && perf.kmPerLitre > 0) {
    return {
      value: perf.kmPerLitre,
      label: `${perf.kmPerLitre.toFixed(1)} km/L`,
      sub: perf.windowDays ? `Last ${perf.windowDays} days` : 'Measured',
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
