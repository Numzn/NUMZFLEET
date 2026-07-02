import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { traccarPath } from '../../config/traccarApi.js';
import fetchOrThrow from '../../common/util/fetchOrThrow.js';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';
import { fetchVehicle, updateVehicleConfig as putVehicleConfig, fuelApiErrorMessage } from '../vehiclesApi.js';
import { normalizePositionTelemetry } from './telemetryUtils.js';
import { getIgnitionPhrase, getMotionDurationLabel, getMotionLabel } from './vehicleMotionStatus.js';
import useMotionDurationTick from './useMotionDurationTick.js';
import { isGeofenceEventType, resolveEventType } from './vehicleAlertUtils.js';

const erbFuelKey = (fuelType) => {
  if (!fuelType) return 'diesel';
  const t = String(fuelType).toLowerCase();
  if (t.includes('diesel')) return 'diesel';
  if (t.includes('petrol') || t.includes('gasoline')) return 'petrol';
  if (t.includes('kerosene')) return 'kerosene';
  if (t.includes('jet')) return 'jetA1';
  return 'diesel';
};

const normalizeErbPrices = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  let any = false;
  for (const key of ['petrol', 'diesel', 'kerosene', 'jetA1']) {
    const v = raw[key];
    const n = v != null && v !== '' ? Number(v) : NaN;
    if (Number.isFinite(n)) {
      out[key] = n;
      any = true;
    }
  }
  return any ? out : null;
};

const RECENT_EVENTS_MS = 24 * 60 * 60 * 1000;

function eventMatchesDevice(event, deviceId) {
  if (deviceId == null || event?.deviceId == null) return false;
  return Number(event.deviceId) === Number(deviceId);
}

function mergeDeviceEvents(liveEvents, historicalEvents, deviceId) {
  const byId = new Map();
  for (const e of historicalEvents) {
    if (eventMatchesDevice(e, deviceId)) byId.set(e.id, e);
  }
  for (const e of liveEvents) {
    if (eventMatchesDevice(e, deviceId)) byId.set(e.id, e);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const ta = new Date(a.eventTime || a.serverTime || a.deviceTime || 0).getTime();
    const tb = new Date(b.eventTime || b.serverTime || b.deviceTime || 0).getTime();
    return tb - ta;
  });
}

/**
 * Vehicle-centric operational data keyed by fleet vehicle id.
 * @param {string} vehicleId Fleet vehicle UUID
 * @returns {object} Shape includes `deviceId` (Traccar assignment for sockets/live map/events). Treat as internal wiring;
 *   user-facing navigation should stay on `/fleet/vehicles/…`, not `/settings/device/…`.
 */
export default function useVehicleData(vehicleId) {
  const user = useSelector((s) => s.session.user);
  const positions = useSelector((s) => s.session.positions);
  const events = useSelector((s) => s.events.items);
  const devicesById = useSelector((s) => s.devices.items);
  const groupsById = useSelector((s) => s.groups.items);
  const motionNow = useMotionDurationTick();

  const [vehicle, setVehicle] = useState(null);
  const [erbState, setErbState] = useState({
    pricePerL: null,
    fuelKey: 'diesel',
    timestamp: null,
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historicalEvents, setHistoricalEvents] = useState([]);

  const refresh = useCallback(async () => {
    if (!vehicleId || !user) return;
    setError(null);
    setLoading(true);
    try {
      const v = await fetchVehicle(user, vehicleId);
      setVehicle(v);
    } catch (e) {
      const msg = fuelApiErrorMessage(e, 'Failed to load vehicle');
      if (/not found/i.test(msg)) {
        setError('This vehicle no longer exists in your fleet.');
        window.dispatchEvent(new CustomEvent('numz:fleet-vehicles-changed'));
      } else {
        setError(msg);
      }
      setVehicle(null);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deviceId = vehicle?.assignment?.deviceId ?? null;
  const livePosition = deviceId != null ? positions[deviceId] : null;

  useEffect(() => {
    if (deviceId == null) {
      setHistoricalEvents([]);
      return undefined;
    }
    let cancelled = false;
    const loadRecentEvents = async () => {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - RECENT_EVENTS_MS).toISOString();
      const query = new URLSearchParams({ from, to, deviceId: String(deviceId) });
      try {
        const res = await fetchOrThrow(`${traccarPath('/api/reports/events')}?${query.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        const rows = await res.json();
        if (!cancelled) {
          setHistoricalEvents(Array.isArray(rows) ? rows : []);
        }
      } catch {
        if (!cancelled) setHistoricalEvents([]);
      }
    };
    loadRecentEvents();
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    let cancelled = false;
    const loadErb = async () => {
      const fuelKey = erbFuelKey(vehicle?.vehicleSpec?.fuelType);
      try {
        const res = await fetch('/api/reports/erb/latest', {
          credentials: 'include',
          headers: { Accept: 'application/json', ...fuelApiAuthHeaders(user) },
        });
        const payload = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setErbState({
            pricePerL: null,
            fuelKey,
            timestamp: null,
            error: payload?.error || `ERB ${res.status}`,
          });
          return;
        }
        const prices = normalizeErbPrices(payload?.prices);
        const pricePerL = prices?.[fuelKey] ?? null;
        setErbState({
          pricePerL,
          fuelKey,
          timestamp: payload?.timestamp ?? payload?.meta?.fetchedAt ?? null,
          error: pricePerL == null ? 'No price for this fuel type' : null,
        });
      } catch (e) {
        if (!cancelled) {
          setErbState({
            pricePerL: null,
            fuelKey,
            timestamp: null,
            error: e.message || 'ERB fetch failed',
          });
        }
      }
    };
    if (vehicle && user) {
      loadErb();
    }
    return () => {
      cancelled = true;
    };
  }, [vehicle, user]);

  const telemetry = useMemo(() => {
    const apiPos = vehicle?.position;
    const liveAttrs =
      livePosition?.attributes && typeof livePosition.attributes === 'object'
        ? livePosition.attributes
        : null;
    const apiTelemetry = apiPos?.telemetry
      || (apiPos?.attributes ? normalizePositionTelemetry(apiPos.attributes) : null)
      || normalizePositionTelemetry(null);
    const liveTelemetry = liveAttrs ? normalizePositionTelemetry(liveAttrs) : null;
    const base = liveTelemetry
      ? {
        ...apiTelemetry,
        ...liveTelemetry,
        fuelPct: liveTelemetry.fuelPct ?? apiTelemetry.fuelPct ?? null,
      }
      : apiTelemetry;
    const speed =
      livePosition?.speed != null
        ? Number(livePosition.speed)
        : apiPos?.speed != null
          ? Number(apiPos.speed)
          : null;
    const liveTs = livePosition?.deviceTime || livePosition?.fixTime;
    const fixTime = liveTs
      ? new Date(liveTs).toISOString()
      : apiPos?.fixTime ?? null;
    return {
      ...base,
      speedKph: Number.isFinite(speed) ? speed : null,
      speedLimitKph: base.speedLimitKph,
      fixTime,
    };
  }, [vehicle, livePosition]);

  const fuelFallback = useMemo(() => ({
    levelPct: telemetry.fuelPct,
    capacityL: vehicle?.vehicleSpec?.tankCapacity != null ? Number(vehicle.vehicleSpec.tankCapacity) : null,
    litresLeft: null,
    rangeKm: null,
    lPer100km: null,
    fuelEfficiencyKmL: vehicle?.vehicleSpec?.fuelEfficiency != null
      ? Number(vehicle.vehicleSpec.fuelEfficiency)
      : null,
  }), [telemetry.fuelPct, vehicle?.vehicleSpec?.tankCapacity, vehicle?.vehicleSpec?.fuelEfficiency]);

  const showGeofenceAlerts = vehicle?.fleetConfig?.alerts?.geofence !== false;

  const { alerts, geofenceAlertsSuppressed } = useMemo(() => {
    if (deviceId == null) {
      return { alerts: [], geofenceAlertsSuppressed: 0 };
    }
    const deviceEvents = mergeDeviceEvents(events, historicalEvents, deviceId);
    let suppressed = 0;
    const visible = deviceEvents.filter((e) => {
      if (!showGeofenceAlerts && isGeofenceEventType(e.type, e.attributes)) {
        suppressed += 1;
        return false;
      }
      return true;
    });
    return {
      alerts: visible.slice(0, 12).map((e) => ({
        id: e.id,
        type: resolveEventType(e.type, e.attributes),
        message: e.attributes?.message || resolveEventType(e.type, e.attributes),
        time: e.serverTime || e.deviceTime || e.eventTime || null,
        attributes: e.attributes,
      })),
      geofenceAlertsSuppressed: suppressed,
    };
  }, [events, historicalEvents, deviceId, showGeofenceAlerts]);

  const groupName = useMemo(() => {
    if (deviceId == null) return null;
    const d = devicesById[deviceId];
    const gid = d?.groupId;
    if (gid == null) return null;
    return groupsById[gid]?.name ?? null;
  }, [devicesById, groupsById, deviceId]);

  const motionLabel = useMemo(
    () => getMotionLabel(vehicle?.device?.status, livePosition?.speed),
    [vehicle?.device?.status, livePosition?.speed],
  );

  const ignitionPhrase = useMemo(
    () =>
      vehicle?.device?.status === 'online'
        ? getIgnitionPhrase(livePosition?.attributes)
        : null,
    [vehicle?.device?.status, livePosition?.attributes],
  );

  const motionDurationLabel = useMemo(
    () =>
      vehicle?.device?.status === 'online'
        ? getMotionDurationLabel(
          deviceId,
          vehicle.device.status,
          livePosition?.speed,
          motionNow,
          livePosition?.attributes,
        )
        : null,
    [deviceId, vehicle?.device?.status, livePosition?.speed, livePosition?.attributes, motionNow],
  );

  const saveConfig = useCallback(
    async (body) => {
      if (!user || !vehicleId) throw new Error('Not ready');
      const merged = await putVehicleConfig(user, vehicleId, body);
      setVehicle(merged);
      return merged;
    },
    [user, vehicleId],
  );

  return {
    vehicle,
    telemetry,
    fuelFallback,
    erb: erbState,
    alerts,
    geofenceAlertsHidden: !showGeofenceAlerts,
    geofenceAlertsSuppressed,
    loading,
    error,
    refresh,
    saveConfig,
    livePosition,
    deviceId,
    groupName,
    motionLabel,
    motionDurationLabel,
    ignitionPhrase,
  };
}
