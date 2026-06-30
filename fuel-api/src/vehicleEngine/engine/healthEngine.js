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

function scoreBattery(telemetry = {}) {
  const { batteryHealthPct, batteryVoltage } = telemetry;
  if (batteryHealthPct != null) return clampScore(Number(batteryHealthPct));
  if (batteryVoltage == null) return null;
  const v = Number(batteryVoltage);
  if (v >= 12.6) return 95;
  if (v >= 12.4) return 88;
  if (v >= 12.0) return 72;
  if (v >= 11.5) return 50;
  return 35;
}

function scoreCoolant(c) {
  if (c == null) return null;
  if (c >= 110) return 40;
  if (c >= 100) return 65;
  if (c >= 85) return 80;
  return 92;
}

export function healthLabel(score) {
  if (score == null) return null;
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Poor';
}

export function buildHealthEngine({ hub, registry }) {
  const telemetry = hub?.telemetry?.telemetry ?? null;
  const schedules = hub?.maintenance?.schedules ?? [];
  const fuelHub = hub?.fuel ?? {};
  const online = hub?.telemetry?.online ?? false;

  const domains = {
    maintenance: hub?.maintenance?.scheduleHealthScore ?? null,
    fuel: null,
    telemetry: null,
    gps: online ? 100 : 55,
  };

  const rows = [];
  const scores = [];

  if (domains.maintenance != null) {
    scores.push(domains.maintenance);
  }

  if (telemetry?.fuelPct != null) {
    const pct = Math.round(Number(telemetry.fuelPct));
    domains.fuel = scoreFuelLevel(pct);
    scores.push(domains.fuel);
    rows.push({ id: 'fuel', label: 'Fuel level', value: `${pct}%`, score: domains.fuel });
  } else if (fuelHub.measured && fuelHub.kmPerLitre != null) {
    domains.fuel = 85;
    scores.push(domains.fuel);
  }

  const batt = scoreBattery(telemetry || {});
  if (telemetry?.batteryHealthPct != null || telemetry?.batteryVoltage != null) {
    domains.telemetry = batt;
    scores.push(batt);
  }

  if (telemetry?.coolantC != null) {
    const cScore = scoreCoolant(Math.round(Number(telemetry.coolantC)));
    scores.push(cScore);
  }

  scores.push(domains.gps);

  const overall = scores.length
    ? clampScore(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  return {
    overall,
    label: healthLabel(overall),
    domains,
    rows,
  };
}
