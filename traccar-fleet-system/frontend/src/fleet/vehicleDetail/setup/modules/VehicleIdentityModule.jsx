import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
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
      <TextField
        label="Make"
        value={form.make}
        onChange={(e) => patch({ make: e.target.value })}
        fullWidth
        size="small"
        placeholder="e.g. Volvo"
        sx={{ mb: 2 }}
      />
      <TextField
        label="Model"
        value={form.model}
        onChange={(e) => patch({ model: e.target.value })}
        fullWidth
        size="small"
        placeholder="e.g. FH16"
        sx={{ mb: 2 }}
      />
      <TextField
        label="Home base"
        value={form.homeBaseLabel}
        onChange={(e) => patch({ homeBaseLabel: e.target.value })}
        fullWidth
        size="small"
        placeholder="e.g. Nairobi Yard"
        sx={{ mb: 2 }}
      />
      <FormControl fullWidth size="small">
        <InputLabel id="vt-label">Vehicle type</InputLabel>
        <Select
          labelId="vt-label"
          label="Vehicle type"
          value={form.vehicleType}
          onChange={(e) => patch({ vehicleType: e.target.value })}
        >
          {VEHICLE_TYPES.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
        {!canSaveSpecs && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            You can choose a type now; it is saved when a tracker is linked.
          </Typography>
        )}
      </FormControl>
    </>
  );
}
