import { useMemo } from 'react';
import useConnectivity from '../../connectivity/useConnectivity.js';

/**
 * Resolve a single screen-state token from the standard inputs every data
 * surface has: data, loading, error, optional last-success timestamp.
 *
 * Returned states (mutually exclusive):
 *   loading   first load in progress, no data yet
 *   error     last load failed and we have no data to show
 *   offline   we are offline and have no data to show
 *   stale     we have prior data but failed to refresh / are offline
 *   empty     load succeeded and there is genuinely nothing to show
 *   success   load succeeded and there is data
 *
 * "empty" is never used to indicate failure; that is what "error" / "offline"
 * are for.
 */
const useResourceState = ({
  data,
  loading = false,
  error = null,
  lastSuccessAt = null,
  isEmpty,
}) => {
  const { isBrowserOnline, backendReachable } = useConnectivity();
  const offline = !isBrowserOnline || !backendReachable;

  return useMemo(() => {
    const hasData = Array.isArray(data)
      ? data.length > 0
      : data !== null && data !== undefined;

    const empty = typeof isEmpty === 'function'
      ? isEmpty(data)
      : Array.isArray(data) && data.length === 0;

    if (hasData) {
      if (error || offline) return 'stale';
      return 'success';
    }
    if (loading) return 'loading';
    if (offline) return 'offline';
    if (error) return 'error';
    if (empty) return 'empty';
    return 'loading';
  }, [data, loading, error, offline, isEmpty]);
};

export default useResourceState;
