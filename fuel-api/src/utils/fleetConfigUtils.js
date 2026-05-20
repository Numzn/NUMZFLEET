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
function normalizeBool(value, defaultValue) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return defaultValue;
}

export function parseDeviceFleetConfig(deviceAttributes) {
  let raw = deviceAttributes?.numzFleetConfig;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const merged = deepMerge(DEFAULT_FLEET_CONFIG, raw && typeof raw === 'object' ? raw : {});
  merged.geofenceEnabled = normalizeBool(merged.geofenceEnabled, DEFAULT_FLEET_CONFIG.geofenceEnabled);
  if (merged.alerts && typeof merged.alerts === 'object') {
    merged.alerts = {
      ...merged.alerts,
      lowFuel: normalizeBool(merged.alerts.lowFuel, DEFAULT_FLEET_CONFIG.alerts.lowFuel),
      speeding: normalizeBool(merged.alerts.speeding, DEFAULT_FLEET_CONFIG.alerts.speeding),
      geofence: normalizeBool(merged.alerts.geofence, DEFAULT_FLEET_CONFIG.alerts.geofence),
      engineCut: normalizeBool(merged.alerts.engineCut, DEFAULT_FLEET_CONFIG.alerts.engineCut),
    };
  }
  return merged;
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
