import { useCallback, useEffect, useRef, useState } from 'react';
import { fuelApiErrorMessage } from '../../vehiclesApi.js';

export const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'];

const defaultForm = () => ({
  name: '',
  plate: '',
  make: '',
  model: '',
  homeBaseLabel: '',
  vehicleType: 'light_duty',
  fuelType: 'Diesel',
  tankCapacity: '',
  lowFuelThresholdPct: '15',
  lPer100km: '',
  updateIntervalSec: '10',
  geofenceRadiusM: '300',
  alLow: true,
  alSpeed: true,
  alGeo: true,
  alCut: false,
  routineServiceIntervalKm: '5000',
  routineServiceStartingOdometerKm: '',
});

/** Coerce fleet config booleans without treating false as missing. */
function fleetBool(value, defaultValue = false) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

function formSnapshotKey(form) {
  return JSON.stringify(form);
}

export function buildFormFromVehicle(vehicle) {
  if (!vehicle) return defaultForm();
  const fleet = vehicle.fleetConfig;
  const eff = vehicle.vehicleSpec?.fuelEfficiency;
  return {
    name: vehicle.name ?? '',
    plate: vehicle.plateNumber ?? '',
    make: vehicle.make ?? '',
    model: vehicle.model ?? '',
    homeBaseLabel: vehicle.homeBaseLabel ?? '',
    vehicleType: fleet?.vehicleType ?? 'light_duty',
    fuelType: vehicle.vehicleSpec?.fuelType ?? 'Diesel',
    tankCapacity:
      vehicle.vehicleSpec?.tankCapacity != null ? String(vehicle.vehicleSpec.tankCapacity) : '',
    lowFuelThresholdPct:
      fleet?.lowFuelThresholdPct != null ? String(fleet.lowFuelThresholdPct) : '15',
    lPer100km:
      eff != null && Number(eff) > 0 ? String(Math.round((100 / Number(eff)) * 10) / 10) : '',
    updateIntervalSec: fleet?.updateIntervalSec != null ? String(fleet.updateIntervalSec) : '10',
    geofenceRadiusM: fleet?.geofenceRadiusM != null ? String(fleet.geofenceRadiusM) : '300',
    alLow: fleet?.alerts?.lowFuel !== false,
    alSpeed: fleet?.alerts?.speeding !== false,
    alGeo: fleet?.alerts?.geofence !== false,
    alCut: fleetBool(fleet?.alerts?.engineCut, false),
    routineServiceIntervalKm:
      fleet?.routineService?.intervalKm != null
        ? String(fleet.routineService.intervalKm)
        : '5000',
    routineServiceStartingOdometerKm:
      fleet?.routineService?.startingOdometerKm != null
        ? String(Math.round(Number(fleet.routineService.startingOdometerKm)))
        : '',
  };
}

export default function useVehicleSetupForm(vehicle) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [dirty, setDirty] = useState(false);
  const vehicleId = vehicle?.id ?? null;
  const prevVehicleIdRef = useRef(null);
  const skipNextVehicleSyncRef = useRef(false);

  // Hydrate on vehicle switch; sync from server when not dirty (skip refresh clobbering edits).
  useEffect(() => {
    if (!vehicleId || !vehicle) return;
    if (prevVehicleIdRef.current !== vehicleId) {
      prevVehicleIdRef.current = vehicleId;
      skipNextVehicleSyncRef.current = false;
      setForm(buildFormFromVehicle(vehicle));
      setDirty(false);
      return;
    }
    if (dirty) return;
    if (skipNextVehicleSyncRef.current) {
      skipNextVehicleSyncRef.current = false;
      return;
    }
    const nextForm = buildFormFromVehicle(vehicle);
    setForm((prev) => (formSnapshotKey(prev) === formSnapshotKey(nextForm) ? prev : nextForm));
  }, [vehicleId, vehicle, dirty]);

  const patch = useCallback((updates) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const deviceId = vehicle?.assignment?.deviceId;
  const canSaveSpecs = deviceId != null;

  const buildSaveBody = useCallback(() => {
    if (!form.name.trim()) {
      return { error: 'Name is required' };
    }
    const body = {
      name: form.name.trim(),
      plateNumber: form.plate.trim() || null,
    };
    if (canSaveSpecs) {
      Object.assign(body, {
        vehicleType: form.vehicleType,
        fuelType: form.fuelType,
        tankCapacity: form.tankCapacity === '' ? null : Number(form.tankCapacity),
        fuelConsumptionLPer100km: form.lPer100km === '' ? null : Number(form.lPer100km),
        lowFuelThresholdPct: form.lowFuelThresholdPct === '' ? null : Number(form.lowFuelThresholdPct),
        updateIntervalSec: form.updateIntervalSec === '' ? null : Number(form.updateIntervalSec),
        geofenceEnabled: form.alGeo !== false,
        geofenceRadiusM: form.geofenceRadiusM === '' ? null : Number(form.geofenceRadiusM),
        alerts: {
          lowFuel: form.alLow,
          speeding: form.alSpeed,
          geofence: form.alGeo,
          engineCut: form.alCut,
        },
      });
    }
    return { body };
  }, [form, canSaveSpecs]);

  const save = useCallback(
    async (saveConfig) => {
      setErr(null);
      const built = buildSaveBody();
      if (built.error) {
        setErr(built.error);
        throw new Error(built.error);
      }
      setSaving(true);
      try {
        const merged = await saveConfig(built.body);
        setDirty(false);
        if (merged) {
          skipNextVehicleSyncRef.current = true;
          setForm(buildFormFromVehicle(merged));
        }
        return merged;
      } catch (e) {
        const msg = fuelApiErrorMessage(
          e,
          'Save failed — check NumzLab connection (Fuel API) and try again.',
        );
        setErr(msg);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [buildSaveBody],
  );

  return {
    form,
    patch,
    saving,
    err,
    setErr,
    dirty,
    deviceId,
    canSaveSpecs,
    save,
  };
}
