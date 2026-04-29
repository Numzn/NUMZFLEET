import { getTraccarPosition } from '../config/traccar.js';
import { findLatestByVehicleId } from '../repositories/operationSessionRefuelRepository.js';

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
    const mileage = Number(position?.attributes?.odometer ?? position?.attributes?.totalDistance ?? position?.attributes?.mileage);
    const tankLevelFraction = normalizeTankLevel(position?.attributes);

    return {
      source: 'traccar',
      mileage: Number.isFinite(mileage) ? mileage : null,
      tankLevelFraction,
    };
  } catch (error) {
    return {
      source: 'unavailable',
      mileage: null,
      tankLevelFraction: null,
    };
  }
}

export async function getTelemetryWithFallback(deviceId) {
  const telemetry = await getVehicleTelemetry(deviceId);
  if (telemetry.mileage != null) {
    return telemetry;
  }

  const lastRefuel = await findLatestByVehicleId(deviceId);
  return {
    ...telemetry,
    source: telemetry.source === 'traccar' ? 'fallback-last-refuel' : telemetry.source,
    mileage: lastRefuel?.currentMileage != null ? Number(lastRefuel.currentMileage) : null,
  };
}
