import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchVehicleEngine } from '../../vehiclesApi.js';

/** Map engine.fuel to FuelCard / workspace fuel shape. */
export function fuelSnapshotFromEngine(snapshot) {
  const ef = snapshot?.engine?.fuel;
  if (!ef) return null;
  return {
    levelPct: ef.tankLevelPct,
    tankLevelSource: ef.tankLevelSource,
    capacityL: ef.capacityL,
    litresLeft: ef.litresRemaining,
    rangeKm: ef.estimatedRangeKm,
    lPer100km: ef.lPer100km,
    fuelEfficiencyKmL: ef.efficiencyKmL,
    efficiencySource: ef.efficiencySource,
    confidence: ef.confidence,
    estimatedFillCostZmw: ef.estimatedFillCostZmw,
    trend: ef.trend,
    intervalCount: ef.intervalCount,
    sampleCount: ef.sampleCount,
    windowDays: ef.windowDays,
  };
}

/** Map engine fuel to legacy fuelPerformance shape used by display helpers. */
export function fuelPerformanceFromEngine(snapshot) {
  const ef = snapshot?.engine?.fuel;
  if (!ef) return null;
  const stats = ef.measuredStats ?? {};
  const isMeasured = ef.efficiencySource === 'measured' || ef.efficiencySource === 'learned';
  return {
    measured: isMeasured,
    kmPerLitre: ef.efficiencyKmL,
    trend: ef.trend,
    windowDays: ef.windowDays,
    totalDistanceKm: stats.totalDistanceKm,
    totalFuelLitres: stats.totalFuelLitres,
    intervalCount: ef.intervalCount,
    confidence: ef.confidence,
    efficiencySource: ef.efficiencySource,
    learnableIntervalCount: stats.learnableIntervalCount,
    storedIntervalCount: stats.storedIntervalCount,
    rejectedIntervalCount: stats.rejectedIntervalCount,
  };
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
        title: engine.maintenance.nextService.label || engine.maintenance.nextService.name,
        dueDate: null,
        remainingKm: engine.maintenance.nextService.remainingKm,
        status: engine.maintenance.nextService.status,
        statusLabel: engine.maintenance.nextService.statusLabel,
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
    odometerKm: snapshot?.registry?.odometerKm ?? null,
    odometerConfidence: snapshot?.registry?.odometerConfidence ?? null,
    odometerDriftPct: snapshot?.registry?.odometerDriftPct ?? null,
    odometerDriftClass: snapshot?.registry?.odometerDriftClass ?? null,
    capabilities: snapshot?.capabilities ?? null,
    hub: snapshot?.hub ?? null,
    engine: snapshot?.engine ?? null,
    intelligence: snapshot?.intelligence ?? null,
    timeline: snapshot?.timeline ?? [],
    fuelSnapshot: fuelSnapshotFromEngine(snapshot),
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
