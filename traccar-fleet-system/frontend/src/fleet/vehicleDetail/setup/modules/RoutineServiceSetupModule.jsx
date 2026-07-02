import { useEffect } from 'react';
import {
  Alert, Box, List, ListItem, ListItemText, TextField, Typography,
} from '@mui/material';
import useVehicleEngine from '../../hooks/useVehicleEngine.js';
import {
  ROUTINE_SERVICE_CHECKLIST,
  ROUTINE_SERVICE_DEFAULT_INTERVAL_KM,
} from '../../../routineServiceConstants.js';

export default function RoutineServiceSetupModule({
  form,
  patch,
  canSaveSpecs,
  fleetVehicleId,
}) {
  const { odometerKm, loading: engineLoading } = useVehicleEngine(fleetVehicleId);

  useEffect(() => {
    if (!canSaveSpecs || engineLoading) return;
    if (form.routineServiceStartingOdometerKm !== '') return;
    if (odometerKm == null || !Number.isFinite(Number(odometerKm))) return;
    patch({ routineServiceStartingOdometerKm: String(Math.round(Number(odometerKm))) });
  }, [
    canSaveSpecs,
    engineLoading,
    odometerKm,
    form.routineServiceStartingOdometerKm,
    patch,
  ]);

  return (
    <>
      {!canSaveSpecs && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Link a device to configure Routine Service for this vehicle.
        </Alert>
      )}
      <TextField
        label="Routine Service Interval (KM)"
        value={form.routineServiceIntervalKm}
        onChange={(e) => patch({ routineServiceIntervalKm: e.target.value })}
        fullWidth
        size="small"
        type="number"
        disabled={!canSaveSpecs}
        helperText={`Default ${ROUTINE_SERVICE_DEFAULT_INTERVAL_KM.toLocaleString()} km`}
        sx={{ mb: 2 }}
      />
      <TextField
        label="Starting Odometer (KM)"
        value={form.routineServiceStartingOdometerKm}
        onChange={(e) => patch({ routineServiceStartingOdometerKm: e.target.value })}
        fullWidth
        size="small"
        type="number"
        disabled={!canSaveSpecs}
        helperText={
          engineLoading
            ? 'Loading odometer from Vehicle Engine…'
            : 'Last service baseline — prefilled from live odometer when available'
        }
        sx={{ mb: 2 }}
      />
      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
          Service checklist (informational)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          These items are included in each Routine Service but are not individually scheduled.
        </Typography>
        <List dense disablePadding sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1 }}>
          {ROUTINE_SERVICE_CHECKLIST.map((item) => (
            <ListItem key={item} disableGutters sx={{ py: 0.25 }}>
              <ListItemText
                primary={item}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </>
  );
}
