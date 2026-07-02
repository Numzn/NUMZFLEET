import { Alert, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { FUEL_TYPES } from '../useVehicleSetupForm.js';
import VehicleOdometerObservation from './VehicleOdometerObservation.jsx';

export default function FuelSetupModule({ form, patch, canSaveSpecs, deviceId, fleetVehicleId }) {
  const isElectric = form.fuelType === 'Electric';

  return (
    <>
      {!canSaveSpecs && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Link a device to configure fuel planning for this vehicle.
        </Alert>
      )}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel id="ft-label">Fuel type</InputLabel>
        <Select
          labelId="ft-label"
          label="Fuel type"
          value={form.fuelType}
          onChange={(e) => patch({ fuelType: e.target.value })}
          disabled={!canSaveSpecs}
        >
          {FUEL_TYPES.map((f) => (
            <MenuItem key={f} value={f}>
              {f}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label={isElectric ? 'Energy store capacity' : 'Tank capacity (L)'}
        value={form.tankCapacity}
        onChange={(e) => patch({ tankCapacity: e.target.value })}
        fullWidth
        size="small"
        type="number"
        disabled={!canSaveSpecs}
        sx={{ mb: 2 }}
      />
      <TextField
        label="Low fuel threshold (%)"
        value={form.lowFuelThresholdPct}
        onChange={(e) => patch({ lowFuelThresholdPct: e.target.value })}
        fullWidth
        size="small"
        type="number"
        disabled={!canSaveSpecs}
        sx={{ mb: 2 }}
      />
      <TextField
        label="Consumption (L/100 km)"
        value={form.lPer100km}
        onChange={(e) => patch({ lPer100km: e.target.value })}
        fullWidth
        size="small"
        type="number"
        disabled={!canSaveSpecs || isElectric}
        helperText={
          isElectric
            ? 'Not required for electric vehicles.'
            : !canSaveSpecs
              ? 'Assign a device to edit consumption'
              : ' '
        }
      />
      {canSaveSpecs && deviceId != null && fleetVehicleId && (
        <VehicleOdometerObservation fleetVehicleId={fleetVehicleId} />
      )}
    </>
  );
}
