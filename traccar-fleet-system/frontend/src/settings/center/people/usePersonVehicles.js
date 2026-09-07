import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useVehicleDisplayContext } from '../../../fleet/display/VehicleDisplayRegistryContext';

/**
 * Which vehicle is this driver currently on.
 *
 * There is no stored driver-to-vehicle assignment to read: the association is
 * reported by the vehicle itself, which tags its position with the driver's
 * identifier. This is the same cross-reference the Drivers list already does,
 * resolved through the display registry so the result carries a name a person
 * recognises and an id that can be linked to.
 *
 * Because it is derived from live telemetry, a vehicle only appears once it has
 * reported with this driver aboard — it is not a record of who is assigned.
 */
export default function usePersonVehicles(driver) {
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const { getDisplayForDevice } = useVehicleDisplayContext();

  return useMemo(() => {
    const uniqueId = driver?.uniqueId;
    if (!uniqueId) return [];

    return Object.values(positions || {})
      .filter((position) => String(position?.attributes?.driverUniqueId ?? '') === String(uniqueId))
      .map((position) => {
        const device = devices?.[position.deviceId];
        const display = getDisplayForDevice(position.deviceId, device);
        return {
          deviceId: position.deviceId,
          name: display?.primary || device?.name || `#${position.deviceId}`,
          fleetVehicleId: display?.fleetVehicleId || null,
        };
      });
  }, [driver, devices, positions, getDisplayForDevice]);
}
