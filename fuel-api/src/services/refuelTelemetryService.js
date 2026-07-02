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
      positionAttributes: null,
    };
  }
}

/** Tank level (+ raw position attrs). Odometer resolution is owned by the Vehicle Odometer Engine. */
export async function getTelemetryWithFallback(deviceId) {
  return getVehicleTelemetry(deviceId);
}
