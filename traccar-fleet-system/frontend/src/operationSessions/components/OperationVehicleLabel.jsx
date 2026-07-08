import { Box, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { useVehicleDisplayContext } from '../../fleet/display/VehicleDisplayRegistryContext';

export default function OperationVehicleLabel({
  deviceId,
  titleVariant = 'subtitle1',
  titleWeight = 800,
  compact = false,
  titleSx,
  secondarySx,
}) {
  const devicesItems = useSelector((state) => state.devices.items || {});
  const device = devicesItems[deviceId];
  const { getDisplayForDevice } = useVehicleDisplayContext();
  const display = getDisplayForDevice(deviceId, device);

  return (
    <Box>
      <Typography variant={titleVariant} fontWeight={titleWeight} component="div" sx={titleSx}>
        {display.primary}
      </Typography>
      {display.secondary && !compact ? (
        <Typography variant="body2" color="text.secondary" sx={secondarySx}>
          {display.secondary}
        </Typography>
      ) : null}
    </Box>
  );
}

export function useOperationVehicleDisplay(deviceId) {
  const devicesItems = useSelector((state) => state.devices.items || {});
  const device = devicesItems[deviceId];
  const { getDisplayForDevice } = useVehicleDisplayContext();
  return getDisplayForDevice(deviceId, device);
}
