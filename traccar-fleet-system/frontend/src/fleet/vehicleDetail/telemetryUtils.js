import { normalizeFuelLevelFromAttrs } from './normalizeFuelLevel.js';

/**
 * Align with fuel-api `normalizePositionTelemetry` (Traccar attribute keys vary by device).
 * @param {Record<string, unknown>|null|undefined} attrs
 */
export function normalizePositionTelemetry(attrs) {
  const empty = {
    rpm: null,
    coolantC: null,
    engineLoadPct: null,
    fuelPct: null,
    totalDistance: null,
    ignition: null,
    speedLimitKph: null,
    batteryVoltage: null,
    batteryHealthPct: null,
    tireFl: null,
    tireFr: null,
    tireRl: null,
    tireRr: null,
    tireAvgPsi: null,
  };

  if (!attrs || typeof attrs !== 'object') {
    return empty;
  }

  const n = (v) => {
    if (v == null || v === '') return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };

  const tireFl = n(attrs.tirePressureFrontLeft ?? attrs.tpmsFl ?? attrs.tyrePressureFl);
  const tireFr = n(attrs.tirePressureFrontRight ?? attrs.tpmsFr ?? attrs.tyrePressureFr);
  const tireRl = n(attrs.tirePressureRearLeft ?? attrs.tpmsRl ?? attrs.tyrePressureRl);
  const tireRr = n(attrs.tirePressureRearRight ?? attrs.tpmsRr ?? attrs.tyrePressureRr);
  const tireValues = [tireFl, tireFr, tireRl, tireRr].filter((v) => v != null);
  const tireAvgPsi = tireValues.length
    ? Math.round((tireValues.reduce((a, b) => a + b, 0) / tireValues.length) * 10) / 10
    : null;

  return {
    rpm: n(attrs.rpm ?? attrs.engineRpm ?? attrs.RPM),
    coolantC: n(
      attrs.coolantTemperature ?? attrs.coolantTemp ?? attrs.engineTemperature ?? attrs.temp ?? attrs.temperature,
    ),
    engineLoadPct: n(attrs.engineLoad ?? attrs.pdt ?? attrs.obdEngineLoad),
    fuelPct: normalizeFuelLevelFromAttrs(attrs),
    totalDistance: n(attrs.totalDistance),
    ignition: attrs.ignition ?? attrs.engineOn ?? attrs.ignitionOn ?? null,
    speedLimitKph: n(attrs.speedLimit ?? attrs.speedLimitKph),
    batteryVoltage: n(attrs.battery ?? attrs.power ?? attrs.batteryVoltage ?? attrs.externalPower),
    batteryHealthPct: n(attrs.batteryLevel ?? attrs.batteryHealth),
    tireFl,
    tireFr,
    tireRl,
    tireRr,
    tireAvgPsi,
  };
}
