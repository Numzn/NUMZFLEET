import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { VEHICLE_TYPES } from '../../vehicleDetailSections.js';

export default function VehicleIdentityModule({ form, patch, canSaveSpecs }) {
  return (
    <>
      <TextField
        label="Name"
        value={form.name}
        onChange={(e) => patch({ name: e.target.value })}
        fullWidth
        required
        size="small"
        sx={{ mb: 2 }}
      />
      <TextField
        label="Plate"
        value={form.plate}
        onChange={(e) => patch({ plate: e.target.value })}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />
      <FormControl fullWidth size="small">
        <InputLabel id="vt-label">Vehicle type</InputLabel>
        <Select
          labelId="vt-label"
          label="Vehicle type"
          value={form.vehicleType}
          onChange={(e) => patch({ vehicleType: e.target.value })}
          disabled={!canSaveSpecs}
        >
          {VEHICLE_TYPES.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </>
  );
}
