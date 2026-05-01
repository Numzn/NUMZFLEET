/**
 * Align with fuel-api `normalizePositionTelemetry` (Traccar attribute keys vary by device).
 * @param {Record<string, unknown>|null|undefined} attrs
 */
export function normalizePositionTelemetry(attrs) {
  if (!attrs || typeof attrs !== 'object') {
    return {
      rpm: null,
      coolantC: null,
      engineLoadPct: null,
      fuelPct: null,
      totalDistance: null,
      ignition: null,
      speedLimitKph: null,
    };
  }

  const n = (v) => {
    if (v == null || v === '') return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };

  return {
    rpm: n(attrs.rpm ?? attrs.engineRpm ?? attrs.RPM),
    coolantC: n(
      attrs.coolantTemperature ?? attrs.coolantTemp ?? attrs.engineTemperature ?? attrs.temp ?? attrs.temperature,
    ),
    engineLoadPct: n(attrs.engineLoad ?? attrs.pdt ?? attrs.obdEngineLoad),
    fuelPct: n(attrs.fuel ?? attrs.fuelLevel ?? attrs.fuel1),
    totalDistance: n(attrs.totalDistance),
    ignition: attrs.ignition ?? attrs.engineOn ?? attrs.ignitionOn ?? null,
    speedLimitKph: n(attrs.speedLimit ?? attrs.speedLimitKph),
  };
}
