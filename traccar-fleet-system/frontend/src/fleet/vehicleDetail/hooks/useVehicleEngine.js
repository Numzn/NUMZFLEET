import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { fetchVehicleEngine } from '../../vehiclesApi.js';
import useCachedResource from '../../../common/cache/useCachedResource.js';
import { makeResourceKey } from '../../../common/cache/resourceCache.js';
import useMileageSignalRefresh from '../../display/useMileageSignalRefresh.js';

const ENGINE_POLL_MS = 60_000;
const ENGINE_CACHE_TTL_MS = 60_000;

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

export default function useVehicleEngine(fleetVehicleId, { deviceId = null } = {}) {
  const user = useSelector((s) => s.session.user);
  const cacheKey = user && fleetVehicleId ? makeResourceKey('vehicleEngine', fleetVehicleId) : null;

  const fetcher = useCallback(
    () => fetchVehicleEngine(user, fleetVehicleId),
    [user, fleetVehicleId],
  );

  // Last-known-good + silent-revalidate, sessionStorage-backed so a hard
  // refresh doesn't drop straight to null (this fetch is the heaviest one on
  // the page — fuel calc, maintenance due-state, compliance — so it used to
  // resolve visibly later than the lighter vehicle fetch, flashing "Not
  // configured" for Routine Service before this data arrived). Strictly
  // keyed by fleetVehicleId — see src/common/cache/resourceCache.js.
  const cached = useCachedResource(cacheKey, fetcher, {
    ttl: ENGINE_CACHE_TTL_MS,
    persist: true,
    revalidateOnMount: true,
  });

  const cachedRef = useRef(cached);
  cachedRef.current = cached;

  // `reload` is the pre-existing public contract (poll, telemetry-triggered
  // debounce, and post-mutation callers all expect a guaranteed-fresh fetch,
  // not one that can dedupe onto a stale in-flight response). `silent` no
  // longer changes anything: loading vs. refreshing is now derived
  // automatically from whether cached data already exists.
  const reload = useCallback(() => cachedRef.current.invalidate(), []);

  // Live mileage: re-fetch the resolved snapshot (odometer, Routine Service remaining km and status) when the
  // shared signal says THIS vehicle's tracker reported new distance, the live connection came back, or the tab
  // was shown after a while. Coalesced and rate-limited, so a moving vehicle costs a bounded number of
  // requests. A vehicle without a tracker has nothing to listen for.
  const { markLoaded } = useMileageSignalRefresh(
    () => cachedRef.current.invalidate(),
    { deviceId, enabled: Boolean(user && fleetVehicleId && deviceId != null) },
  );
  const markLoadedRef = useRef(markLoaded);
  markLoadedRef.current = markLoaded;

  // Periodic refresh while workspace is open (covers devices that rarely emit
  // distance attrs). Skips while the tab isn't visible — a backgrounded tab
  // shouldn't keep spending from the shared per-IP request budget.
  useEffect(() => {
    if (!user || !fleetVehicleId) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      reload();
      markLoadedRef.current();
    }, ENGINE_POLL_MS);
    return () => window.clearInterval(id);
  }, [user, fleetVehicleId, reload]);

  const snapshot = cached.data ?? null;
  const maintenanceItems = snapshot?.hub?.maintenance?.schedules ?? [];
  const dueSoonCount = snapshot?.engine?.maintenance?.actionableCount ?? 0;
  const openWorkOrders = snapshot?.hub?.maintenance?.workOrders?.active ?? [];

  return {
    snapshot,
    /** True only when no cached snapshot exists yet for this vehicle (real first load). */
    loading: cached.loading,
    initialLoading: cached.loading,
    refreshing: cached.refreshing,
    stale: cached.stale,
    error: cached.error?.message ?? null,
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
      loading: cached.loading,
      dueSoonCount,
      openWorkOrders,
      summary: snapshot?.hub?.maintenance?.workOrders?.summary ?? null,
    },
    fuelPerformance: fuelPerformanceFromEngine(snapshot),
    overviewMetrics: overviewMetricsFromEngine(snapshot),
  };
}

