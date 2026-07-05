import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  fetchResource, hydrateFromStorage, invalidate, isStale, peekEntry, subscribe,
} from './resourceCache.js';

/**
 * Last-known-good + silent-revalidate binding for one cache key.
 *
 * loading    = no usable data yet and a fetch is pending (only true state worth a skeleton)
 * refreshing = usable data is visible while a background fetch is pending
 * stale      = usable data is visible but past its ttl, or its last refresh failed
 *
 * See resourceCache.js for the underlying dedup/sequencing/persistence rules.
 * Not yet wired to any Vehicle Workspace component — see the Checkpoint A report.
 */
export default function useCachedResource(key, fetcher, options = {}) {
  const { ttl = null, persist = false, revalidateOnMount = true } = options;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const subscribeFn = useCallback((onStoreChange) => subscribe(key, onStoreChange), [key]);
  const getSnapshot = useCallback(() => peekEntry(key), [key]);
  const entry = useSyncExternalStore(subscribeFn, getSnapshot, getSnapshot);

  const runFetch = useCallback((fetchOptions) => (
    fetchResource(key, () => fetcherRef.current(), { persist, ...fetchOptions }).catch(() => null)
  ), [key, persist]);

  useEffect(() => {
    if (key == null) return;
    const hydrated = hydrateFromStorage(key, { persist }) ?? peekEntry(key);
    if (!hydrated.hasData || revalidateOnMount || isStale(hydrated, ttl)) {
      runFetch();
    }
    // key/persist/ttl/revalidateOnMount fully describe when this should re-run;
    // runFetch/fetcher identity intentionally excluded to avoid refetch loops.
  }, [key, persist, ttl, revalidateOnMount]);

  const refresh = useCallback((refreshOptions) => runFetch(refreshOptions), [runFetch]);

  const invalidateAndRefresh = useCallback(() => {
    if (key == null) return Promise.resolve(null);
    invalidate(key);
    return runFetch({ force: true });
  }, [key, runFetch]);

  return {
    data: entry.hasData ? entry.data : undefined,
    loading: !entry.hasData && entry.pending,
    refreshing: entry.hasData && entry.pending,
    stale: isStale(entry, ttl),
    error: entry.error,
    fetchedAt: entry.fetchedAt,
    refresh,
    invalidate: invalidateAndRefresh,
  };
}
