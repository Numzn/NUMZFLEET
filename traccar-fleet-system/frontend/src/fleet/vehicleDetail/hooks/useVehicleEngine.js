import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchVehicleEngine } from '../../vehiclesApi.js';

/** Map engine hub fuel to legacy fuelPerformance shape used by display helpers. */
export function fuelPerformanceFromEngine(snapshot) {
  const fuel = snapshot?.hub?.fuel;
  const engineFuel = snapshot?.engine?.fuel;
  if (!fuel) return null;
  if (fuel.measured && fuel.kmPerLitre != null) {
    return {
      measured: true,
      kmPerLitre: fuel.kmPerLitre,
      trend: fuel.trend,
    };
  }
  if (engineFuel?.efficiencyKmL != null) {
    return {
      measured: false,
      kmPerLitre: engineFuel.efficiencyKmL,
    };
  }
  return null;
}

/** Map engine to legacy overview-metrics shape. */
export function overviewMetricsFromEngine(snapshot) {
  if (!snapshot?.engine) return null;
  const { engine, hub } = snapshot;
  return {
    fuelEfficiencyKmL: engine.fuel.efficiencyKmL,
    fleetFuelEfficiencyAvg: engine.fuel.fleetEfficiencyAvg,
    fleetEfficiencyDeltaPct: engine.fuel.fleetDeltaPct,
    maintenanceCostMtd: engine.costs.maintenanceMtd,
    maintenanceCostYtd: engine.costs.maintenanceYtd,
    maintenanceCostLifetime: engine.costs.maintenanceLifetime,
    maintenanceLifetimeSince: hub?.maintenance?.costs?.lifetimeSince ?? null,
    nextService: engine.maintenance.nextService
      ? {
        title: engine.maintenance.nextService.name,
        dueDate: null,
        remainingKm: engine.maintenance.nextService.remainingKm,
      }
      : null,
  };
}

export default function useVehicleEngine(fleetVehicleId) {
  const user = useSelector((s) => s.session.user);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!user || !fleetVehicleId) {
      setSnapshot(null);
      setError(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVehicleEngine(user, fleetVehicleId);
      setSnapshot(data);
      return data;
    } catch (err) {
      setSnapshot(null);
      setError(err?.message || 'Failed to load vehicle engine');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, fleetVehicleId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const maintenanceItems = snapshot?.hub?.maintenance?.schedules ?? [];
  const dueSoonCount = snapshot?.engine?.maintenance?.actionableCount ?? 0;
  const openWorkOrders = snapshot?.hub?.maintenance?.workOrders?.active ?? [];

  return {
    snapshot,
    loading,
    error,
    reload,
    registry: snapshot?.registry ?? null,
    capabilities: snapshot?.capabilities ?? null,
    hub: snapshot?.hub ?? null,
    engine: snapshot?.engine ?? null,
    intelligence: snapshot?.intelligence ?? null,
    timeline: snapshot?.timeline ?? [],
    maintenance: {
      items: maintenanceItems,
      loading,
      dueSoonCount,
      openWorkOrders,
      summary: snapshot?.hub?.maintenance?.workOrders?.summary ?? null,
    },
    fuelPerformance: fuelPerformanceFromEngine(snapshot),
    overviewMetrics: overviewMetricsFromEngine(snapshot),
  };
}
