import { createContext, useContext, useMemo } from 'react';
import useVehicleDisplayRegistry from './useVehicleDisplayRegistry';
import useMileageSignalSource from './useMileageSignalSource';
import { lookupVehicleDisplay } from './resolveVehicleDisplay';

const VehicleDisplayRegistryContext = createContext(null);

export function VehicleDisplayRegistryProvider({ children }) {
  const registry = useVehicleDisplayRegistry();
  // The one place live tracker data becomes a "mileage may have changed" signal for every screen.
  useMileageSignalSource();
  const value = useMemo(() => registry, [registry]);
  return (
    <VehicleDisplayRegistryContext.Provider value={value}>
      {children}
    </VehicleDisplayRegistryContext.Provider>
  );
}

/**
 * @returns {ReturnType<typeof useVehicleDisplayRegistry> & { getDisplayForDevice: Function }}
 */
export function useVehicleDisplayContext() {
  const ctx = useContext(VehicleDisplayRegistryContext);
  if (ctx) return ctx;
  return {
    rows: [],
    loading: false,
    error: null,
    reload: async () => {},
    byDeviceId: new Map(),
    byFleetVehicleId: new Map(),
    fleetVehicleIdByDeviceId: {},
    getDisplayForDevice: (deviceId, device) => lookupVehicleDisplay(null, deviceId, device),
  };
}

export default VehicleDisplayRegistryContext;
