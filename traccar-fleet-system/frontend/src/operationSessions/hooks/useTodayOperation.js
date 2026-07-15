import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchOperationSessionDetails, fetchOperationSessions } from '../api/operationSessionsApi.js';
import { findTodayOperation, findTodayOperations, resolveFleetTimezone } from '../utils/operationDayUtils.js';
import { OPERATION_SESSION_SOCKET_EVENT } from '../utils/operationSessionSocketBridge.js';

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onSocketUpdate = (event) => {
      const { sessionId, refuel, invoice, type } = event.detail || {};
      if (!sessionId) return;
      setTodayDetails((prev) => {
        if (!prev || Number(prev.id) !== Number(sessionId)) return prev;
        if (type === 'invoice.reconciled') {
          if (!invoice?.id) return prev;
          const existing = Array.isArray(prev.invoices) ? prev.invoices : [];
          const idx = existing.findIndex((i) => Number(i.id) === Number(invoice.id));
          const invoices = idx >= 0
            ? existing.map((i, k) => (k === idx ? invoice : i))
            : [...existing, invoice];
          return { ...prev, invoices };
        }
        if (!refuel?.id || !Array.isArray(prev.refuels)) return prev;
        const refuels = prev.refuels.map((r) => (
          Number(r.id) === Number(refuel.id) ? { ...r, ...refuel } : r
        ));
        return { ...prev, refuels };
      });
    };
    window.addEventListener(OPERATION_SESSION_SOCKET_EVENT, onSocketUpdate);
    return () => window.removeEventListener(OPERATION_SESSION_SOCKET_EVENT, onSocketUpdate);
  }, []);

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
