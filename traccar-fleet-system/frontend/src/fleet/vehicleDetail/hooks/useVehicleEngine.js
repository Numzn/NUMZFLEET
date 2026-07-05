import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchVehicleEngine } from '../../vehiclesApi.js';

const ENGINE_POLL_MS = 60_000;
const ENGINE_RELOAD_DEBOUNCE_MS = 5_000;

/** Stable fingerprint of mileage evidence on a live Traccar position. */
export function mileageEvidenceFingerprint(position) {
  const attrs = position?.attributes;
  if (!attrs || typeof attrs !== 'object') return null;
  for (const key of ['odometer', 'totalDistance', 'mileage']) {
    const raw = attrs[key];
    if (raw == null || raw === '') continue;
    const num = Number(raw);
    if (Number.isFinite(num)) return `${key}:${num}`;
  }
  return null;
}

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

export default function useVehicleEngine(fleetVehicleId, { deviceId = null, livePosition = null } = {}) {
  const user = useSelector((s) => s.session.user);
  const [snapshot, setSnapshot] = useState(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const reloadRef = useRef(null);
  const lastEvidenceRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const hasSnapshotRef = useRef(false);

  const reload = useCallback(async ({ silent } = {}) => {
    if (!user || !fleetVehicleId) {
      hasSnapshotRef.current = false;
      setSnapshot(null);
      setError(null);
      setInitialLoading(false);
      setRefreshing(false);
      return null;
    }

    const isSilent = silent ?? hasSnapshotRef.current;
    if (isSilent) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    setError(null);

    try {
      const data = await fetchVehicleEngine(user, fleetVehicleId);
      setSnapshot(data);
      hasSnapshotRef.current = data != null;
      return data;
    } catch (err) {
      if (!isSilent) {
        hasSnapshotRef.current = false;
        setSnapshot(null);
        setError(err?.message || 'Failed to load vehicle engine');
      }
      return null;
    } finally {
      if (isSilent) {
        setRefreshing(false);
      } else {
        setInitialLoading(false);
      }
    }
  }, [user, fleetVehicleId]);

  reloadRef.current = reload;

  useEffect(() => {
    hasSnapshotRef.current = false;
    setSnapshot(null);
    setError(null);
    lastEvidenceRef.current = null;
    reload({ silent: false });
  }, [reload]);

  // Refresh engine when live tracker mileage evidence changes (debounced).
  useEffect(() => {
    if (deviceId == null) return undefined;
    const fingerprint = mileageEvidenceFingerprint(livePosition);
    if (fingerprint == null) return undefined;
    if (lastEvidenceRef.current === fingerprint) return undefined;
    lastEvidenceRef.current = fingerprint;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      reloadRef.current?.({ silent: true });
    }, ENGINE_RELOAD_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [deviceId, livePosition]);

  // Periodic refresh while workspace is open (covers devices that rarely emit
  // distance attrs). Skips while the tab isn't visible — a backgrounded tab
  // shouldn't keep spending from the shared per-IP request budget.
  useEffect(() => {
    if (!user || !fleetVehicleId) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      reloadRef.current?.({ silent: true });
    }, ENGINE_POLL_MS);
    return () => window.clearInterval(id);
  }, [user, fleetVehicleId]);

  const maintenanceItems = snapshot?.hub?.maintenance?.schedules ?? [];
  const dueSoonCount = snapshot?.engine?.maintenance?.actionableCount ?? 0;
  const openWorkOrders = snapshot?.hub?.maintenance?.workOrders?.active ?? [];

  return {
    snapshot,
    /** True only on first load for this vehicle (no cached snapshot yet). */
    loading: initialLoading,
    initialLoading,
    refreshing,
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
    activity: snapshot?.engine?.activity ?? null,
    intelligence: snapshot?.intelligence ?? null,
    timeline: snapshot?.timeline ?? [],
    fuelSnapshot: fuelSnapshotFromEngine(snapshot),
    maintenance: {
      items: maintenanceItems,
      loading: initialLoading,
      dueSoonCount,
      openWorkOrders,
      summary: snapshot?.hub?.maintenance?.workOrders?.summary ?? null,
    },
    fuelPerformance: fuelPerformanceFromEngine(snapshot),
    overviewMetrics: overviewMetricsFromEngine(snapshot),
  };
}

