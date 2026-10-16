import { getTraccarPosition } from '../config/traccar.js';

function normalizeTankLevel(attributes = {}) {
  const raw = attributes?.fuelLevel ?? attributes?.fuel ?? attributes?.fuel_level;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value > 1 && value <= 100) {
    return Number((value / 100).toFixed(4));
  }
  if (value >= 0 && value <= 1) {
    return Number(value.toFixed(4));
  }
  return null;
}

export async function getVehicleTelemetry(deviceId) {
  try {
    const position = await getTraccarPosition(deviceId);
    const attrs = position?.attributes || {};
    const tankLevelFraction = normalizeTankLevel(attrs);

    return {
      source: 'traccar',
      tankLevelFraction,
      // Freshness evidence for the Vehicle Odometer Engine: without it a single-device
      // resolution cannot tell a live tracker from a dead one (see collectEvidence).
      deviceStatus: position?.deviceStatus ?? null,
      deviceLastUpdate: position?.deviceLastUpdate ?? null,
      positionFixTime: position?.fixtime ?? null,
      positionId: position?.id ?? null,
      positionAttributes: {
        odometer: attrs.odometer,
        totalDistance: attrs.totalDistance,
        mileage: attrs.mileage,
      },
    };
  } catch (error) {
    return {
      source: 'unavailable',
      tankLevelFraction: null,
      deviceStatus: null,
      deviceLastUpdate: null,
      positionFixTime: null,
      positionId: null,
      positionAttributes: null,
    };
  }
}

/** Tank level (+ raw position attrs). Odometer resolution is owned by the Vehicle Odometer Engine. */
export async function getTelemetryWithFallback(deviceId) {
  return getVehicleTelemetry(deviceId);
}
