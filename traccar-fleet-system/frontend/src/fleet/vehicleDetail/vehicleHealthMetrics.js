import { resolveFuelEfficiencyDisplay } from './fuelEfficiencyDisplay.js';

function clampScore(n) {
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreFuelLevel(pct) {
  if (pct == null) return null;
  if (pct <= 10) return 35;
  if (pct <= 20) return 55;
  if (pct <= 35) return 75;
  return 95;
}

function scoreBattery({ batteryHealthPct, batteryVoltage }) {
  if (batteryHealthPct != null) return clampScore(batteryHealthPct);
  if (batteryVoltage == null) return null;
  if (batteryVoltage >= 12.6) return 95;
  if (batteryVoltage >= 12.4) return 88;
  if (batteryVoltage >= 12.0) return 72;
  if (batteryVoltage >= 11.5) return 50;
  return 35;
}

function scoreCoolant(c) {
  if (c == null) return null;
  if (c >= 110) return 40;
  if (c >= 100) return 65;
  if (c >= 85) return 80;
  return 92;
}

function scoreMaintenance(items = []) {
  const actionable = items.filter((i) => i.isActionable);
  const overdue = actionable.filter((i) => i.isOverdue);
  const dueSoon = actionable.filter((i) => !i.isOverdue);
  if (overdue.length > 0) return Math.max(25, 55 - overdue.length * 10);
  if (dueSoon.length > 0) return Math.max(55, 85 - dueSoon.length * 8);
  if (items.length > 0) return 95;
  return null;
}

function maintenanceDisplay(items = []) {
  const actionable = items.filter((i) => i.isActionable);
  const overdue = actionable.filter((i) => i.isOverdue);
  const dueSoon = actionable.filter((i) => !i.isOverdue);
  if (overdue.length > 0) {
    const name = overdue[0]?.name;
    return {
      value: overdue.length === 1 && name ? `Overdue: ${name}` : `${overdue.length} overdue`,
      severity: 'error',
    };
  }
  if (dueSoon.length > 0) {
    const name = dueSoon[0]?.name;
    return {
      value: dueSoon.length === 1 && name ? `Due: ${name}` : `${dueSoon.length} due soon`,
      severity: 'warning',
    };
  }
  if (items.length > 0) {
    return { value: 'Up to date', severity: 'success' };
  }
  return null;
}

function severityFromScore(score) {
  if (score == null) return 'default';
  if (score >= 85) return 'success';
  if (score >= 65) return 'warning';
  return 'error';
}

/**
 * Build health rows from live telemetry, Traccar maintenance, and measured fuel performance.
 * Omits metrics with no real backing data (no placeholder percentages).
 */
export function buildVehicleHealthMetrics({
  telemetry,
  maintenanceItems = [],
  fuelPerformance,
  online,
}) {
  const rows = [];

  const maintDisplay = maintenanceDisplay(maintenanceItems);
  const maintScore = scoreMaintenance(maintenanceItems);
  if (maintDisplay) {
    rows.push({
      id: 'maintenance',
      label: 'Maintenance',
      value: maintDisplay.value,
      severity: maintDisplay.severity,
      score: maintScore,
      source: 'traccar',
    });
  }

  if (telemetry?.fuelPct != null) {
    const pct = Math.round(Number(telemetry.fuelPct));
    const score = scoreFuelLevel(pct);
    rows.push({
      id: 'fuel',
      label: 'Fuel level',
      value: `${pct}%`,
      severity: pct <= 15 ? 'warning' : 'success',
      score,
      source: 'telemetry',
    });
  }

  const battScore = scoreBattery(telemetry || {});
  if (telemetry?.batteryHealthPct != null) {
    rows.push({
      id: 'battery',
      label: 'Battery',
      value: `${Math.round(telemetry.batteryHealthPct)}%`,
      severity: severityFromScore(battScore),
      score: battScore,
      source: 'telemetry',
    });
  } else if (telemetry?.batteryVoltage != null) {
    rows.push({
      id: 'battery',
      label: 'Battery',
      value: `${Number(telemetry.batteryVoltage).toFixed(1)} V`,
      severity: severityFromScore(battScore),
      score: battScore,
      source: 'telemetry',
    });
  }

  if (telemetry?.coolantC != null) {
    const c = Math.round(Number(telemetry.coolantC));
    const score = scoreCoolant(c);
    rows.push({
      id: 'coolant',
      label: 'Coolant',
      value: `${c}°C`,
      severity: c >= 110 ? 'error' : c >= 100 ? 'warning' : 'success',
      score,
      source: 'telemetry',
    });
  }

  const efficiency = resolveFuelEfficiencyDisplay(fuelPerformance, null);
  if (efficiency.source === 'measured') {
    rows.push({
      id: 'economy',
      label: 'Fuel economy',
      value: efficiency.label,
      severity: 'success',
      score: null,
      source: 'refuels',
      hint: efficiency.sub,
    });
  }

  rows.push({
    id: 'tracker',
    label: 'Tracker',
    value: online ? 'Online' : 'Offline',
    severity: online ? 'success' : 'default',
    score: online ? 100 : 55,
    source: 'device',
  });

  const scored = rows.filter((r) => r.score != null);
  const composite = scored.length
    ? clampScore(scored.reduce((s, r) => s + r.score, 0) / scored.length)
    : null;

  const hasTelemetry = rows.some((r) => r.source === 'telemetry');
  const subtitle = hasTelemetry
    ? 'Live telemetry & service data'
    : (rows.length > 1 ? 'Service & device status' : 'Waiting for device data');

  return { composite, rows, subtitle, scoredCount: scored.length };
}

/** Pick the most actionable rows for the compact sidebar. */
export function pickHealthDisplayRows(rows, max = 4) {
  const byId = (id) => rows.find((r) => r.id === id);
  const picked = [];

  const maintenance = byId('maintenance');
  const tracker = byId('tracker');
  if (maintenance) picked.push(maintenance);
  if (tracker) picked.push(tracker);

  rows
    .filter((r) => r.source === 'telemetry')
    .forEach((r) => {
      if (picked.length < max && !picked.includes(r)) picked.push(r);
    });

  const economy = rows.find((r) => r.id === 'economy');
  if (economy && picked.length < max) picked.push(economy);

  return picked.slice(0, max);
}

export function healthLabel(score) {
  if (score == null) return 'No score';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs attention';
}
