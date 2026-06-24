import { useCallback, useMemo, useState } from 'react';
import { useEffectAsync } from '../../../reactHelper';
import { traccarPath } from '../../../config/traccarApi.js';
import fetchOrThrow from '../../../common/util/fetchOrThrow';

const DUE_SOON_RATIO = 0.1;

function withActionableFlags(computed) {
  const isActionable = !computed.unknown
    && computed.remaining != null
    && (computed.dueSoon || computed.remaining <= 0);
  const isOverdue = !computed.unknown
    && computed.remaining != null
    && computed.remaining <= 0;
  return { ...computed, isActionable, isOverdue };
}

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
    return withActionableFlags({
      ...m,
      isTime,
      nextDue,
      remaining,
      dueSoon: period > 0 && remaining <= period * DUE_SOON_RATIO,
      unknown: false,
    });
  }

  const positionValue = Number(position?.attributes?.[m.type]);
  const current = Number.isFinite(positionValue)
    ? positionValue
    : (m.type === 'totalDistance' && Number.isFinite(Number(odometerFallbackMeters))
      ? Number(odometerFallbackMeters)
      : NaN);
  if (!Number.isFinite(current) || period <= 0) {
    return withActionableFlags({
      ...m,
      isTime,
      current: Number.isFinite(current) ? current : null,
      remaining: null,
      dueSoon: false,
      unknown: true,
    });
  }

  let nextDue;
  if (current < start) {
    nextDue = start;
  } else {
    const cycles = Math.floor((current - start) / period) + 1;
    nextDue = start + cycles * period;
  }
  const remaining = nextDue - current;
  return withActionableFlags({
    ...m,
    isTime,
    current,
    nextDue,
    remaining,
    dueSoon: remaining <= period * DUE_SOON_RATIO,
    unknown: false,
  });
}

/**
 * Linked Traccar maintenance schedules for a device, with next-due computed
 * against the live position accumulators.
 */
export default function useVehicleMaintenance(deviceId, position, odometerFallbackKm = null) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

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
  }, [deviceId, refreshKey]);

  const odometerFallbackMeters = Number.isFinite(Number(odometerFallbackKm))
    ? Number(odometerFallbackKm) * 1000
    : null;

  const computed = useMemo(
    () => items.map((m) => computeDue(m, position, odometerFallbackMeters)),
    [items, position, odometerFallbackMeters],
  );

  const dueSoonCount = computed.filter((c) => c.isActionable).length;

  return {
    items: computed,
    loading,
    error,
    dueSoonCount,
    reload,
  };
}
