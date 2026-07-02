import {
  Box,
  Chip,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { vehicleWorkspacePath } from '../../fleet/vehicleRegistry/vehicleRegistryUtils.js';
import { useVehicleDisplayContext } from '../../fleet/display/VehicleDisplayRegistryContext';
import { resolveKnownFleetVehicleId } from '../../fleet/display/resolveVehicleDisplay';
import { formatLitres, formatZmw } from '../utils/formatters.js';
import {
  isRefuelComplete,
  deriveVehicleWorkflowState,
  VEHICLE_STATE_LABEL,
  vehicleStateChipColor,
} from '../utils/operationDayUtils.js';
import OperationVehicleLabel, { useOperationVehicleDisplay } from './OperationVehicleLabel.jsx';

export default function OperationVehicleRow({ refuel, onReportCorrection, linkTarget = 'profile' }) {
  const navigate = useNavigate();
  const devicesItems = useSelector((state) => state.devices.items || {});
  const { byDeviceId, byFleetVehicleId } = useVehicleDisplayContext();
  const device = devicesItems[refuel.vehicleId];
  const display = useOperationVehicleDisplay(refuel.vehicleId);
  const complete = isRefuelComplete(refuel);
  const workflowState = deriveVehicleWorkflowState(refuel);
  const planned = refuel.plannedFuelLitres != null ? Number(refuel.plannedFuelLitres) : null;
  const actual = refuel.actualFuelLitres != null ? Number(refuel.actualFuelLitres) : null;

  const fuelLine = (
    <>
      Planned:
      {' '}
      {planned != null ? formatLitres(planned) : '—'}
      {' · '}
      Actual:
      {' '}
      {actual != null ? formatLitres(actual) : '—'}
      {refuel.actualCost != null && (
        <>
          {' · '}
          {formatZmw(refuel.actualCost)}
        </>
      )}
      {refuel.odometerKm != null && (
        <>
          {' · '}
          {Number(refuel.odometerKm).toLocaleString()}
          {' km'}
        </>
      )}
    </>
  );

  return (
    <ListItemButton
      onClick={() => {
        if (linkTarget === 'fuel') {
          if (refuel.sessionId) navigate(`/fleet/operation-sessions/fuel/${refuel.sessionId}`);
          return;
        }
        const fleetId = resolveKnownFleetVehicleId(
          { byDeviceId, byFleetVehicleId },
          refuel.vehicleId,
          display.fleetVehicleId || device?.attributes?.fleetVehicleId,
        );
        if (fleetId) navigate(vehicleWorkspacePath(fleetId));
      }}
      secondaryAction={(
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Chip
            size="small"
            label={VEHICLE_STATE_LABEL[workflowState] || 'Planned'}
            color={vehicleStateChipColor(workflowState)}
            variant="outlined"
          />
          {onReportCorrection && complete && (
            <Chip
              size="small"
              label="Correct"
              variant="outlined"
              onClick={(e) => {
                e.stopPropagation();
                onReportCorrection(refuel);
              }}
            />
          )}
        </Box>
      )}
    >
      <ListItemText
        disableTypography
        primary={<OperationVehicleLabel deviceId={refuel.vehicleId} titleVariant="body1" titleWeight={700} compact />}
        secondary={(
          <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
            {fuelLine}
          </Typography>
        )}
      />
    </ListItemButton>
  );
}
