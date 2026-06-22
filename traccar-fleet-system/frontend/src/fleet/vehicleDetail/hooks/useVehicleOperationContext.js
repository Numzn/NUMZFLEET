import useTodayOperationRefuel from './useTodayOperationRefuel.js';
import useLastRefill from './useLastRefill.js';

/**
 * Composite hook for vehicle fuel column — delegates to split hooks.
 * @deprecated Prefer useTodayOperationRefuel and useLastRefill directly.
 */
export default function useVehicleOperationContext(deviceId) {
  const today = useTodayOperationRefuel(deviceId);
  const history = useLastRefill(deviceId);

  const activeRefuel = today.hasTodayPlan
    ? { session: today.details || today.operation, refuel: today.refuel }
    : null;

  return {
    loading: today.loading || history.loading,
    activeRefuel: today.isComplete ? null : activeRefuel,
    lastRefill: history.lastRefill,
    hasOperationData: Boolean((today.hasTodayPlan && !today.isComplete) || history.lastRefill),
  };
}
