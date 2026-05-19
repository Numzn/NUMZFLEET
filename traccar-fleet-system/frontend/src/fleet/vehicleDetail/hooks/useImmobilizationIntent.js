import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  fetchActiveImmobilizationIntent,
  fetchImmobilizationCapabilities,
  fetchImmobilizationIntentHistory,
  createImmobilizationIntent,
  cancelImmobilizationIntent,
} from '../immobilizationIntentsApi.js';

const POLL_MS = 2500;

export default function useImmobilizationIntent(vehicleId) {
  const user = useSelector((s) => s.session.user);
  const [capabilities, setCapabilities] = useState(null);
  const [activeIntent, setActiveIntent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !vehicleId) return;
    setError(null);
    try {
      const [caps, active, hist] = await Promise.all([
        fetchImmobilizationCapabilities(user, vehicleId),
        fetchActiveImmobilizationIntent(user, vehicleId),
        fetchImmobilizationIntentHistory(user, vehicleId, 15),
      ]);
      setCapabilities(caps);
      setActiveIntent(active?.intent ?? null);
      setHistory(hist?.intents ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load immobilization state');
    } finally {
      setLoading(false);
    }
  }, [user, vehicleId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user || !vehicleId) return undefined;
    const activeStatuses = ['pending', 'monitoring', 'executing'];
    const shouldPoll = activeIntent && activeStatuses.includes(activeIntent.status);
    if (!shouldPoll) return undefined;
    const id = setInterval(() => {
      void fetchActiveImmobilizationIntent(user, vehicleId)
        .then((data) => setActiveIntent(data?.intent ?? null))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [user, vehicleId, activeIntent?.id, activeIntent?.status]);

  const requestIntent = useCallback(
    async (action) => {
      if (!user || !vehicleId) return;
      setActionLoading(true);
      setError(null);
      try {
        const data = await createImmobilizationIntent(user, vehicleId, action);
        setActiveIntent(data?.intent ?? null);
        await refresh();
        return data?.intent;
      } catch (e) {
        setError(e.message || 'Request failed');
        throw e;
      } finally {
        setActionLoading(false);
      }
    },
    [user, vehicleId, refresh],
  );

  const cancelActive = useCallback(async () => {
    if (!user || !vehicleId || !activeIntent?.id) return;
    setActionLoading(true);
    setError(null);
    try {
      await cancelImmobilizationIntent(user, vehicleId, activeIntent.id);
      setActiveIntent(null);
      await refresh();
    } catch (e) {
      setError(e.message || 'Cancel failed');
      throw e;
    } finally {
      setActionLoading(false);
    }
  }, [user, vehicleId, activeIntent?.id, refresh]);

  return {
    capabilities,
    activeIntent,
    history,
    loading,
    error,
    actionLoading,
    refresh,
    requestIntent,
    cancelActive,
  };
}
