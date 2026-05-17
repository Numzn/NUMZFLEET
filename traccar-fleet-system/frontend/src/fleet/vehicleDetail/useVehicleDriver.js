import { useCallback, useEffect, useState } from 'react';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { traccarPath } from '../../config/traccarApi.js';

/** Linked drivers for a Traccar device (permissions API). */
export function useLinkedDrivers(deviceId) {
  const [linkedDrivers, setLinkedDrivers] = useState([]);
  const [loading, setLoading] = useState(false);

  const reloadLinked = useCallback(async () => {
    if (deviceId == null) {
      setLinkedDrivers([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchOrThrow(traccarPath(`/api/drivers?deviceId=${deviceId}`));
      const rows = await res.json();
      setLinkedDrivers(Array.isArray(rows) ? rows : []);
    } catch {
      setLinkedDrivers([]);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    reloadLinked();
  }, [reloadLinked]);

  return { linkedDrivers, reloadLinked, loading };
}

/** Replace device ↔ driver permission links (mirrors LinkField contract). */
export async function setDeviceDriverLinks(deviceId, nextDriverId, previousLinkedIds) {
  const prev = (previousLinkedIds || []).filter((id) => id != null);
  const tasks = [];

  for (const oldId of prev) {
    if (oldId !== nextDriverId) {
      tasks.push(
        fetchOrThrow(traccarPath('/api/permissions'), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, driverId: oldId }),
        }),
      );
    }
  }

  if (nextDriverId != null && !prev.includes(nextDriverId)) {
    tasks.push(
      fetchOrThrow(traccarPath('/api/permissions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, driverId: nextDriverId }),
      }),
    );
  }

  await Promise.all(tasks);
}
