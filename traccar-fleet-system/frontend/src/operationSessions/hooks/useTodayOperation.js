import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchOperationSessionDetails, fetchOperationSessions } from '../api/operationSessionsApi.js';
import { findTodayOperation, findTodayOperations, resolveFleetTimezone } from '../utils/operationDayUtils.js';
import useNotificationBridge from '../../notifications/useNotificationBridge.js';

export default function useTodayOperation() {
  const user = useSelector((state) => state.session.user);
  const [sessions, setSessions] = useState([]);
  const [todayDetails, setTodayDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!user) {
      setSessions([]);
      setTodayDetails(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchOperationSessions(user);
      const list = Array.isArray(raw) ? raw : [];
      setSessions(list);
      const today = findTodayOperation(list);
      if (today?.id) {
        const details = await fetchOperationSessionDetails(user, today.id);
        setTodayDetails(details);
      } else {
        setTodayDetails(null);
      }
    } catch (err) {
      setError(err);
      setSessions([]);
      setTodayDetails(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const isTodaySessionFuelNotification = useCallback(
    (n) => n.entityType === 'fuel' && Number(n.metadata?.sessionId) === Number(todayDetails?.id),
    [todayDetails?.id],
  );
  useNotificationBridge(isTodaySessionFuelNotification, reload);

  const fleetTimezone = useMemo(() => resolveFleetTimezone(sessions), [sessions]);
  const todayOperation = useMemo(
    () => findTodayOperation(sessions, fleetTimezone),
    [sessions, fleetTimezone],
  );
  const todayOperations = useMemo(
    () => findTodayOperations(sessions, fleetTimezone),
    [sessions, fleetTimezone],
  );

  return {
    sessions,
    todayOperation,
    todayOperations,
    todayDetails,
    fleetTimezone,
    loading,
    error,
    reload,
  };
}
