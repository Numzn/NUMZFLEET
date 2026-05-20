import { SETUP_MODULE_IDS } from './vehicleSetupModules.js';
import { setupSafetyReadinessFromCapabilities } from '../immobilizationDisplayUtils.js';

/** @typedef {'complete'|'incomplete'|'recommended'|'optional'|'blocked'} SetupStatus */

/**
 * @typedef {object} SetupModuleReadiness
 * @property {string} id
 * @property {SetupStatus} status
 * @property {string} label
 * @property {string} detail
 */

export const SETUP_STATUS_LABELS = {
  complete: 'Complete',
  incomplete: 'Incomplete',
  recommended: 'Recommended',
  optional: 'Optional',
  blocked: 'Blocked',
};

export const SETUP_STATUS_COLORS = {
  complete: 'success',
  incomplete: 'warning',
  recommended: 'warning',
  optional: 'default',
  blocked: 'default',
};

function driverDisplayName(vehicle, linkedDrivers) {
  const linked = linkedDrivers?.[0]?.name?.trim();
  if (linked) return linked;
  return (
    vehicle?.device?.contact ||
    vehicle?.device?.driverName ||
    vehicle?.device?.attributes?.driverName ||
    null
  );
}

function fleetBool(value, defaultValue = false) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

function formFromVehicle(vehicle, formDraft) {
  if (formDraft) return formDraft;
  const fleet = vehicle?.fleetConfig;
  const spec = vehicle?.vehicleSpec;
  const eff = spec?.fuelEfficiency;
  return {
    name: vehicle?.name ?? '',
    plate: vehicle?.plateNumber ?? '',
    vehicleType: fleet?.vehicleType ?? 'light_duty',
    fuelType: spec?.fuelType ?? 'Diesel',
    tankCapacity: spec?.tankCapacity != null ? String(spec.tankCapacity) : '',
    lowFuelThresholdPct: fleet?.lowFuelThresholdPct != null ? String(fleet.lowFuelThresholdPct) : '15',
    lPer100km:
      eff != null && Number(eff) > 0 ? String(Math.round((100 / Number(eff)) * 10) / 10) : '',
    updateIntervalSec: fleet?.updateIntervalSec != null ? String(fleet.updateIntervalSec) : '10',
    geofenceEnabled: fleetBool(fleet?.geofenceEnabled, false),
    geofenceRadiusM: fleet?.geofenceRadiusM != null ? String(fleet.geofenceRadiusM) : '300',
  };
}

function fuelComplete(form, fuelType) {
  const hasTank = Boolean(String(form.tankCapacity || '').trim());
  if (fuelType === 'Electric') {
    return hasTank;
  }
  return hasTank && Boolean(String(form.lPer100km || '').trim());
}

function computeZoneMonitoringReadiness({
  hasDevice,
  monitorEnabled,
  linkedGeofences,
  linkedGeofencesLoading,
  linkedGeofencesError,
}) {
  if (!hasDevice) {
    return {
      status: 'blocked',
      label: 'Requires device',
      detail: 'Link a tracker to configure zone monitoring.',
    };
  }
  if (linkedGeofencesLoading) {
    return {
      status: 'recommended',
      label: 'Checking zone links',
      detail: 'Verifying linked operational zones…',
    };
  }
  if (linkedGeofencesError) {
    return {
      status: 'recommended',
      label: 'Could not verify zones',
      detail: 'Open device connections to confirm zone links for this tracker.',
    };
  }
  const linkedCount = linkedGeofences?.length ?? 0;
  const hasLinks = linkedCount > 0;
  if (hasLinks && monitorEnabled) {
    const names = linkedGeofences
      .map((g) => g?.name?.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    return {
      status: 'complete',
      label: 'Zones linked · Monitoring on',
      detail: names
        ? `${linkedCount} zone${linkedCount === 1 ? '' : 's'}: ${names}${linkedCount > 3 ? '…' : ''}`
        : `${linkedCount} operational zone${linkedCount === 1 ? '' : 's'} linked`,
    };
  }
  if (hasLinks && !monitorEnabled) {
    return {
      status: 'recommended',
      label: 'Zones linked',
      detail: `${linkedCount} zone${linkedCount === 1 ? '' : 's'} linked · Enable “Monitor linked zones”.`,
    };
  }
  if (!hasLinks && monitorEnabled) {
    return {
      status: 'recommended',
      label: 'Monitoring enabled',
      detail: 'No operational zones linked to this device yet.',
    };
  }
  return {
    status: 'recommended',
    label: 'Zone monitoring not configured',
    detail: 'Link operational zones and enable monitoring preference.',
  };
}

/**
 * @param {object} params
 * @param {object|null} params.vehicle
 * @param {object|null} params.formDraft
 * @param {object[]} params.linkedDrivers
 * @param {object[]} params.linkedGeofences
 * @param {boolean} params.linkedGeofencesLoading
 * @param {string|null} params.linkedGeofencesError
 * @param {object|null} params.capabilities
 * @param {boolean} params.disableDrivers
 */
export function computeVehicleSetupReadiness({
  vehicle,
  formDraft,
  linkedDrivers = [],
  linkedGeofences = [],
  linkedGeofencesLoading = false,
  linkedGeofencesError = null,
  capabilities = null,
  disableDrivers = false,
}) {
  const form = formFromVehicle(vehicle, formDraft);
  const deviceId = vehicle?.assignment?.deviceId;
  const hasDevice = deviceId != null;
  const driverName = driverDisplayName(vehicle, linkedDrivers);
  const fuelType = form.fuelType || 'Diesel';

  const modules = [];

  modules.push({
    id: SETUP_MODULE_IDS.identity,
    status: form.name?.trim() ? 'complete' : 'incomplete',
    label: form.name?.trim() ? 'Vehicle identified' : 'Name required',
    detail: form.name?.trim()
      ? [form.plate?.trim(), form.vehicleType].filter(Boolean).join(' · ') || 'Identity saved'
      : 'Enter a display name for this vehicle.',
  });

  modules.push({
    id: SETUP_MODULE_IDS.device,
    status: hasDevice ? 'complete' : 'incomplete',
    label: hasDevice ? 'Tracker linked' : 'No device linked',
    detail: hasDevice
      ? `Tracker ID ${deviceId}`
      : 'Assign a device from the Fleet vehicles list.',
  });

  if (disableDrivers) {
    modules.push({
      id: SETUP_MODULE_IDS.driver,
      status: 'optional',
      label: 'Drivers disabled',
      detail: 'Driver linking is not enabled on this server.',
    });
  } else if (!hasDevice) {
    modules.push({
      id: SETUP_MODULE_IDS.driver,
      status: 'blocked',
      label: 'Assign device first',
      detail: 'Link a tracker before assigning a driver.',
    });
  } else if (driverName) {
    modules.push({
      id: SETUP_MODULE_IDS.driver,
      status: 'complete',
      label: 'Driver assigned',
      detail: driverName,
    });
  } else {
    modules.push({
      id: SETUP_MODULE_IDS.driver,
      status: 'recommended',
      label: 'No driver assigned',
      detail: 'Assign a driver for operational context.',
    });
  }

  if (!hasDevice) {
    modules.push({
      id: SETUP_MODULE_IDS.fuel,
      status: 'blocked',
      label: 'Requires device',
      detail: 'Link a tracker to configure fuel planning.',
    });
  } else if (fuelComplete(form, fuelType)) {
    modules.push({
      id: SETUP_MODULE_IDS.fuel,
      status: 'complete',
      label: 'Fuel planning ready',
      detail: `${fuelType}${form.tankCapacity ? ` · ${form.tankCapacity} L tank` : ''}`,
    });
  } else {
    modules.push({
      id: SETUP_MODULE_IDS.fuel,
      status: 'recommended',
      label: 'Fuel thresholds incomplete',
      detail:
        fuelType === 'Electric'
          ? 'Set tank capacity (or energy store) for planning.'
          : 'Set tank capacity and consumption (L/100 km).',
    });
  }

  modules.push({
    id: SETUP_MODULE_IDS.geofence,
    ...computeZoneMonitoringReadiness({
      hasDevice,
      monitorEnabled: form.geofenceEnabled === true,
      linkedGeofences,
      linkedGeofencesLoading,
      linkedGeofencesError,
    }),
  });

  if (!hasDevice) {
    modules.push({
      id: SETUP_MODULE_IDS.safety,
      status: 'blocked',
      label: 'Requires device',
      detail: 'Link a tracker to check immobilization support.',
    });
  } else {
    const safety = setupSafetyReadinessFromCapabilities(capabilities);
    modules.push({
      id: SETUP_MODULE_IDS.safety,
      status: safety.status,
      label: safety.label,
      detail: safety.detail,
    });
  }

  if (!hasDevice) {
    modules.push({
      id: SETUP_MODULE_IDS.alerts,
      status: 'blocked',
      label: 'Requires device',
      detail: 'Link a tracker to configure alert preferences.',
    });
  } else {
    modules.push({
      id: SETUP_MODULE_IDS.alerts,
      status: 'optional',
      label: 'Alert preferences',
      detail: 'Defaults apply; adjust switches below as needed.',
    });
  }

  const completeCount = modules.filter((m) => m.status === 'complete').length;
  const attentionCount = modules.filter((m) =>
    ['incomplete', 'recommended', 'blocked'].includes(m.status),
  ).length;
  const blockingIncomplete = modules.some((m) => m.status === 'incomplete');

  return {
    modules,
    completeCount,
    attentionCount,
    totalCount: modules.length,
    ready: !blockingIncomplete,
    blockingIncomplete,
  };
}

/** Lightweight check for workspace Settings chip (saved vehicle data only). */
export function hasBlockingSetupIncomplete(vehicle, linkedDrivers = [], disableDrivers = false) {
  if (!vehicle) return false;
  const { blockingIncomplete } = computeVehicleSetupReadiness({
    vehicle,
    linkedDrivers,
    disableDrivers,
  });
  return blockingIncomplete;
}

export function getModuleReadiness(readiness, moduleId) {
  return readiness?.modules?.find((m) => m.id === moduleId) || null;
}
