import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';
import { fetchVehicle, updateVehicleConfig as putVehicleConfig } from '../vehiclesApi.js';
import { normalizePositionTelemetry } from './telemetryUtils.js';
import { getIgnitionPhrase, getMotionLabel } from './vehicleMotionStatus.js';
import { isGeofenceEventType } from './vehicleAlertUtils.js';

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

  const [vehicle, setVehicle] = useState(null);
  const [erbState, setErbState] = useState({
    pricePerL: null,
    fuelKey: 'diesel',
    timestamp: null,
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!vehicleId || !user) return;
    setError(null);
    setLoading(true);
    try {
      const v = await fetchVehicle(user, vehicleId);
      setVehicle(v);
    } catch (e) {
      setError(e.message || 'Failed to load vehicle');
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
    const base = liveAttrs
      ? normalizePositionTelemetry(liveAttrs)
      : apiPos?.telemetry || normalizePositionTelemetry(null);
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

  const fuel = useMemo(() => {
    const cap = vehicle?.vehicleSpec?.tankCapacity != null ? Number(vehicle.vehicleSpec.tankCapacity) : null;
    const eff = vehicle?.vehicleSpec?.fuelEfficiency != null ? Number(vehicle.vehicleSpec.fuelEfficiency) : null;
    const levelPct = telemetry.fuelPct != null ? telemetry.fuelPct : null;
    const litresLeft =
      cap != null && levelPct != null ? Math.round((levelPct / 100) * cap * 10) / 10 : null;
    const rangeKm =
      cap != null && levelPct != null && eff != null && eff > 0
        ? Math.round((levelPct / 100) * cap * eff)
        : null;
    const lPer100km = eff != null && eff > 0 ? Math.round((100 / eff) * 10) / 10 : null;
    return { levelPct, capacityL: cap, litresLeft, rangeKm, lPer100km, fuelEfficiencyKmL: eff };
  }, [vehicle, telemetry.fuelPct]);

  const showGeofenceAlerts = vehicle?.fleetConfig?.alerts?.geofence !== false;

  const { alerts, geofenceAlertsSuppressed } = useMemo(() => {
    if (deviceId == null) {
      return { alerts: [], geofenceAlertsSuppressed: 0 };
    }
    const deviceEvents = events.filter((e) => e.deviceId === deviceId);
    let suppressed = 0;
    const visible = deviceEvents.filter((e) => {
      if (!showGeofenceAlerts && isGeofenceEventType(e.type)) {
        suppressed += 1;
        return false;
      }
      return true;
    });
    return {
      alerts: visible.slice(0, 12).map((e) => ({
        id: e.id,
        type: e.type,
        message: e.attributes?.message || e.type,
        time: e.serverTime || e.deviceTime || null,
      })),
      geofenceAlertsSuppressed: suppressed,
    };
  }, [events, deviceId, showGeofenceAlerts]);

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
    fuel,
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
    ignitionPhrase,
  };
}
