/**
 * Layer 5 — structured findings and recommendations (rule-based v1).
 */
export function buildIntelligence(engine) {
  const findings = [];
  const recommendations = [];

  if (engine?.maintenance?.overdueCount > 0) {
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

  const next = engine?.maintenance?.nextService;
  if (next?.name && (next.urgency === 'overdue' || next.urgency === 'due_soon' || next.urgency === 'due_today')) {
    const withinLabel = next.dueLabel || 'soon';
    recommendations.push({
      domain: 'maintenance',
      action: 'schedule_service',
      severity: next.urgency === 'overdue' ? 'error' : 'warning',
      text: `Schedule ${next.name} — ${withinLabel}`,
      reason: {
        maintenanceId: next.maintenanceId ?? null,
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

  return {
    version: 1,
    findings,
    recommendations,
  };
}
