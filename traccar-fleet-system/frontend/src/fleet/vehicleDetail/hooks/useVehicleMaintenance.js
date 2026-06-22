import { useMemo, useState } from 'react';
import { useEffectAsync } from '../../../reactHelper';
import { traccarPath } from '../../../config/traccarApi.js';
import fetchOrThrow from '../../../common/util/fetchOrThrow';

const DUE_SOON_RATIO = 0.1;

/**
 * Next-due math for a Traccar maintenance schedule.
 * Distance/hours schedules track a position accumulator attribute named by
 * `maintenance.type` (e.g. `totalDistance`); time schedules use epoch `start`
 * plus `period` (ms). Returns remaining-to-next-service and a due-soon flag.
 */
function computeDue(m, position, odometerFallbackMeters) {
  const isTime = typeof m.type === 'string' && m.type.endsWith('Time');
  const start = Number(m.start) || 0;
  const period = Number(m.period) || 0;

  if (isTime) {
    const now = Date.now();
    let nextDue = start;
    if (period > 0 && now > start) {
      const cycles = Math.floor((now - start) / period) + 1;
      nextDue = start + cycles * period;
    }
    const remaining = nextDue - now;
    return {
      ...m,
      isTime,
      nextDue,
      remaining,
      dueSoon: period > 0 && remaining <= period * DUE_SOON_RATIO,
      unknown: false,
    };
  }

  // Prefer the live Traccar accumulator; fall back to the latest operation
  // refuel odometer (bridges fuel-ops mileage into maintenance when telemetry
  // lacks the accumulator). Only `totalDistance` is comparable to refuel km.
  const positionValue = Number(position?.attributes?.[m.type]);
  const current = Number.isFinite(positionValue)
    ? positionValue
    : (m.type === 'totalDistance' && Number.isFinite(Number(odometerFallbackMeters))
      ? Number(odometerFallbackMeters)
      : NaN);
  if (!Number.isFinite(current) || period <= 0) {
    return {
      ...m,
      isTime,
      current: Number.isFinite(current) ? current : null,
      remaining: null,
      dueSoon: false,
      unknown: true,
    };
  }

  let nextDue;
  if (current < start) {
    nextDue = start;
  } else {
    const cycles = Math.floor((current - start) / period) + 1;
    nextDue = start + cycles * period;
  }
  const remaining = nextDue - current;
  return {
    ...m,
    isTime,
    current,
    nextDue,
    remaining,
    dueSoon: remaining <= period * DUE_SOON_RATIO,
    unknown: false,
  };
}

/**
 * Linked Traccar maintenance schedules for a device, with next-due computed
 * against the live position accumulators.
 */
export default function useVehicleMaintenance(deviceId, position, odometerFallbackKm = null) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffectAsync(async () => {
    if (!deviceId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOrThrow(
        traccarPath(`/api/maintenance?deviceId=${encodeURIComponent(deviceId)}`),
      );
      setItems(await res.json());
    } catch (e) {
      setError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  const odometerFallbackMeters = Number.isFinite(Number(odometerFallbackKm))
    ? Number(odometerFallbackKm) * 1000
    : null;

  const computed = useMemo(
    () => items.map((m) => computeDue(m, position, odometerFallbackMeters)),
    [items, position, odometerFallbackMeters],
  );

  const dueSoonCount = computed.filter((c) => c.dueSoon).length;

  return {
    items: computed,
    loading,
    error,
    dueSoonCount,
  };
}
