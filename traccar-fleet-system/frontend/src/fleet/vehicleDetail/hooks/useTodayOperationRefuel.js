import { useMemo } from 'react';
import useTodayOperation from '../../../operationSessions/hooks/useTodayOperation.js';

function matchesDevice(refuelVehicleId, deviceId) {
  if (deviceId == null || !Number.isFinite(Number(deviceId))) return false;
  return Number(refuelVehicleId) === Number(deviceId);
}

export default function useTodayOperationRefuel(deviceId) {
  const { todayDetails, todayOperation, loading } = useTodayOperation();
  const numericDeviceId = deviceId != null ? Number(deviceId) : null;

  return useMemo(() => {
    const refuels = todayDetails?.refuels || [];
    const refuel = refuels.find((r) => matchesDevice(r.vehicleId, numericDeviceId)) || null;
    const actual = refuel?.actualFuelLitres != null ? Number(refuel.actualFuelLitres) : null;
    const isComplete = actual != null && actual > 0;
    const canRefuel = Boolean(
      todayOperation?.canRecordFuel
      && todayDetails?.isWritable
      && refuel
      && !isComplete,
    );

    return {
      loading,
      operation: todayOperation,
      details: todayDetails,
      refuel,
      isComplete,
      canRefuel,
      hasTodayPlan: Boolean(refuel),
    };
  }, [todayDetails, todayOperation, loading, numericDeviceId]);
}
