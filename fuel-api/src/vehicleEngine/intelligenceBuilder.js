/**
 * Layer 5 — structured findings and recommendations (rule-based v1).
 * Important boundary: this layer does not fetch from Documents/Compliance services.
 * It only evaluates already-aggregated engine inputs from Vehicle Engine.
 */
export function buildIntelligence(engine, options = {}) {
  const findings = [];
  const recommendations = [];
  const complianceFindings = Array.isArray(options.complianceFindings)
    ? options.complianceFindings
    : [];

  const next = engine?.maintenance?.nextService;

  if (next?.status === 'overdue') {
    findings.push({
      domain: 'maintenance',
      severity: 'error',
      code: 'ROUTINE_SERVICE_OVERDUE',
      text: `Routine Service overdue${next.remainingKm != null ? ` (${Math.abs(next.remainingKm).toLocaleString()} km)` : ''}`,
    });
  } else if (next?.status && ['due_now', 'prepare', 'due_soon', 'upcoming'].includes(next.status)) {
    findings.push({
      domain: 'maintenance',
      severity: next.status === 'upcoming' ? 'info' : 'warning',
      code: `ROUTINE_SERVICE_${next.status.toUpperCase()}`,
      text: next.statusLabel || 'Routine Service attention needed',
    });
  } else if (engine?.maintenance?.overdueCount > 0) {
    findings.push({
      domain: 'maintenance',
      severity: 'error',
      code: 'MAINTENANCE_OVERDUE',
      text: `${engine.maintenance.overdueCount} overdue service(s)`,
    });
  } else if (engine?.maintenance?.dueSoonCount > 0) {
    findings.push({
      domain: 'maintenance',
      severity: 'warning',
      code: 'MAINTENANCE_DUE_SOON',
      text: `${engine.maintenance.dueSoonCount} service(s) due soon`,
    });
  }

  if (next?.status && next.status !== 'on_track') {
    const withinLabel = next.dueLabel || next.statusLabel || 'soon';
    recommendations.push({
      domain: 'maintenance',
      action: 'schedule_service',
      severity: next.status === 'overdue' ? 'error' : 'warning',
      text: `Complete ${next.label || next.name || 'Routine Service'} — ${withinLabel}`,
      reason: {
        maintenanceId: next.maintenanceId ?? null,
        status: next.status,
        urgency: next.urgency,
        remainingKm: next.remainingKm ?? null,
      },
    });
  }

  if (engine?.fuel?.risk === 'high') {
    findings.push({
      domain: 'fuel',
      severity: 'warning',
      code: 'FUEL_LOW',
      text: 'Low fuel level',
    });
    recommendations.push({
      domain: 'fuel',
      action: 'refuel',
      severity: 'warning',
      text: 'Refuel soon — tank level is low',
    });
  }

  const fuel = engine?.fuel ?? {};
  const registry = options.registry ?? {};
  const hub = options.hub ?? {};

  if (fuel.trend === 'declining' && (fuel.confidence ?? 0) >= 40) {
    findings.push({
      domain: 'fuel',
      severity: 'warning',
      code: 'fuel.efficiency_declining',
      text: 'Fuel efficiency is declining',
    });
  }

  if (fuel.confidence != null && fuel.confidence < 40 && (fuel.sampleCount ?? 0) >= 2) {
    findings.push({
      domain: 'fuel',
      severity: 'info',
      code: 'fuel.low_confidence',
      text: 'Fuel efficiency confidence is low — record more full-tank refuels',
    });
  }

  const odometerConf = registry.odometerConfidence;
  if (odometerConf === 'low' || odometerConf === 'unavailable') {
    findings.push({
      domain: 'fuel',
      severity: 'info',
      code: 'fuel.odometer_untrusted',
      text: 'Odometer confidence is low — confirm dashboard reading',
    });
    recommendations.push({
      domain: 'fuel',
      action: 'confirm_odometer_observation',
      severity: 'info',
      text: 'Record an odometer observation to improve fuel accuracy',
    });
  }

  if (fuel.fleetDeltaPct != null && fuel.fleetDeltaPct < -15) {
    findings.push({
      domain: 'fuel',
      severity: 'warning',
      code: 'fuel.below_fleet_avg',
      text: `Fuel efficiency ${Math.abs(fuel.fleetDeltaPct)}% below fleet average`,
    });
  }

  if (hub.fuel?.tankLevelSource === 'unavailable' && hub.fuel?.sampleCount > 0) {
    findings.push({
      domain: 'fuel',
      severity: 'info',
      code: 'fuel.sensor_missing',
      text: 'Fuel level sensor not reporting — range estimates unavailable',
    });
  }

  if (registry.odometerDriftClass === 'observation_recommended') {
    recommendations.push({
      domain: 'fuel',
      action: 'confirm_odometer_observation',
      severity: 'warning',
      text: 'Odometer drift detected — confirm dashboard reading',
    });
  }

  if (engine?.status?.operational === 'offline') {
    findings.push({
      domain: 'gps',
      severity: 'default',
      code: 'TRACKER_OFFLINE',
      text: 'Tracker offline',
    });
  }

  if (engine?.health?.overall != null && engine.health.overall < 70) {
    findings.push({
      domain: 'health',
      severity: 'warning',
      code: 'HEALTH_ATTENTION',
      text: `Vehicle health ${engine.health.overall}% — attention needed`,
    });
  }

  for (const item of complianceFindings) {
    if (!item?.type || !item?.status) continue;
    if (item.status === 'valid' || item.status === 'unknown') continue;
    const typeLabel = String(item.type).replaceAll('_', ' ').toLowerCase();
    const titleLabel = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
    const dueText = item.daysRemaining == null
      ? null
      : (item.daysRemaining >= 0
        ? `in ${item.daysRemaining} day(s)`
        : `${Math.abs(item.daysRemaining)} day(s) overdue`);
    findings.push({
      domain: 'compliance',
      severity: item.status === 'overdue' || item.status === 'expired' ? 'warning' : 'info',
      code: `COMPLIANCE_${String(item.type).toUpperCase()}_${String(item.status).toUpperCase()}`,
      text: dueText
        ? `${titleLabel} ${item.status} (${dueText})`
        : `${titleLabel} ${item.status}`,
    });
    recommendations.push({
      domain: 'compliance',
      action: 'resolve_compliance_item',
      severity: item.status === 'overdue' || item.status === 'expired' ? 'warning' : 'info',
      text: dueText
        ? `Review ${titleLabel} compliance — due ${dueText}`
        : `Review ${titleLabel} compliance`,
      reason: {
        complianceId: item.complianceId ?? null,
        type: item.type,
        status: item.status,
      },
    });
  }

  return {
    version: 1,
    findings,
    recommendations,
  };
}
