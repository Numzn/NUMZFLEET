import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useVehicleDisplayContext } from '../../fleet/display/VehicleDisplayRegistryContext';

/**
 * Resolves vehicle-centric labels for report rows keyed by Traccar deviceId.
 */
export default function useReportDeviceLabel() {
  const devices = useSelector((state) => state.devices.items);
  const { getDisplayForDevice } = useVehicleDisplayContext();

  const labelForDevice = useCallback((deviceId) => {
    const device = devices[deviceId];
    const display = getDisplayForDevice(deviceId, device);
    if (display.secondary) {
      return `${display.primary} · ${display.secondary}`;
    }
    return display.primary;
  }, [devices, getDisplayForDevice]);

  const primaryForDevice = useCallback((deviceId) => {
    const device = devices[deviceId];
    return getDisplayForDevice(deviceId, device).primary;
  }, [devices, getDisplayForDevice]);

  return { labelForDevice, primaryForDevice };
}
