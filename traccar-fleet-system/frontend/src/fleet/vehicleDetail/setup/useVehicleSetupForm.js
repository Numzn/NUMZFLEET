import { useCallback, useEffect, useState } from 'react';

export const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'];

const defaultForm = () => ({
  name: '',
  plate: '',
  vehicleType: 'light_duty',
  fuelType: 'Diesel',
  tankCapacity: '',
  lowFuelThresholdPct: '15',
  lPer100km: '',
  updateIntervalSec: '10',
  geofenceEnabled: false,
  geofenceRadiusM: '300',
  alLow: true,
  alSpeed: true,
  alGeo: true,
  alCut: false,
});

export default function useVehicleSetupForm(vehicle) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!vehicle) return;
    const fleet = vehicle.fleetConfig;
    const eff = vehicle.vehicleSpec?.fuelEfficiency;
    setForm({
      name: vehicle.name || '',
      plate: vehicle.plateNumber || '',
      vehicleType: fleet?.vehicleType || 'light_duty',
      fuelType: vehicle.vehicleSpec?.fuelType || 'Diesel',
      tankCapacity:
        vehicle.vehicleSpec?.tankCapacity != null ? String(vehicle.vehicleSpec.tankCapacity) : '',
      lowFuelThresholdPct:
        fleet?.lowFuelThresholdPct != null ? String(fleet.lowFuelThresholdPct) : '15',
      lPer100km:
        eff != null && Number(eff) > 0 ? String(Math.round((100 / Number(eff)) * 10) / 10) : '',
      updateIntervalSec: fleet?.updateIntervalSec != null ? String(fleet.updateIntervalSec) : '10',
      geofenceEnabled: Boolean(fleet?.geofenceEnabled),
      geofenceRadiusM: fleet?.geofenceRadiusM != null ? String(fleet.geofenceRadiusM) : '300',
      alLow: fleet?.alerts?.lowFuel !== false,
      alSpeed: fleet?.alerts?.speeding !== false,
      alGeo: fleet?.alerts?.geofence !== false,
      alCut: Boolean(fleet?.alerts?.engineCut),
    });
  }, [vehicle]);

  const patch = useCallback((updates) => {
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
        geofenceEnabled: form.geofenceEnabled,
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
        await saveConfig(built.body);
      } catch (e) {
        const msg = e.message || 'Save failed';
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
    deviceId,
    canSaveSpecs,
    save,
  };
}
