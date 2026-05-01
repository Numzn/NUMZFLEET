/**
 * Fleet UI preferences stored on Traccar device attributes under `numzFleetConfig`.
 * Avoids DB migrations; aligns with fuel-api / Traccar merge pattern.
 */

export const DEFAULT_FLEET_CONFIG = {
  vehicleType: 'light_duty',
  lowFuelThresholdPct: 15,
  updateIntervalSec: 10,
  geofenceEnabled: false,
  geofenceRadiusM: 300,
  alerts: {
    lowFuel: true,
    speeding: true,
    geofence: true,
    engineCut: false,
  },
};

const deepMerge = (base, patch) => {
  if (!patch || typeof patch !== 'object') return { ...base };
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    if (
      pv
      && typeof pv === 'object'
      && !Array.isArray(pv)
      && base[key]
      && typeof base[key] === 'object'
      && !Array.isArray(base[key])
    ) {
      out[key] = deepMerge(base[key], pv);
    } else if (pv !== undefined) {
      out[key] = pv;
    }
  }
  return out;
};

export function parseTraccarAttributesRaw(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** @param {Record<string, unknown>} deviceAttributes */
export function parseDeviceFleetConfig(deviceAttributes) {
  let raw = deviceAttributes?.numzFleetConfig;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return deepMerge(DEFAULT_FLEET_CONFIG, raw && typeof raw === 'object' ? raw : {});
}

/** @param {object} current — result of parseDeviceFleetConfig */
export function mergeFleetConfigFromBody(current, body) {
  const patch = {};
  if (body.vehicleType != null) patch.vehicleType = String(body.vehicleType);
  if (body.lowFuelThresholdPct != null) patch.lowFuelThresholdPct = Number(body.lowFuelThresholdPct);
  if (body.updateIntervalSec != null) patch.updateIntervalSec = Number(body.updateIntervalSec);
  if (body.geofenceEnabled != null) patch.geofenceEnabled = Boolean(body.geofenceEnabled);
  if (body.geofenceRadiusM != null) patch.geofenceRadiusM = Number(body.geofenceRadiusM);
  if (body.alerts && typeof body.alerts === 'object') {
    patch.alerts = body.alerts;
  }
  return deepMerge(current, patch);
}
