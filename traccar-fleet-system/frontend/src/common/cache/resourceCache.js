/**
 * Framework-agnostic "last known good + silent revalidate" cache.
 *
 * One module-level store shared by every useCachedResource() instance, keyed
 * by an opaque string (see makeResourceKey). Kept separate from the React
 * hook so the concurrency/staleness/persistence rules can be unit tested
 * with node:test directly, without a DOM or React renderer.
 *
 * Every mutation to an entry replaces it with a new object (never mutates in
 * place) so useSyncExternalStore's reference-equality snapshot check works
 * correctly: unchanged state -> same reference, changed state -> new one.
 */

export const CACHE_SCHEMA_VERSION = 1;

const STORAGE_PREFIX = 'numz.cache';

/** Shared, frozen "nothing here yet" entry — stable reference for Object.is checks. */
const EMPTY_ENTRY = Object.freeze({
  hasData: false,
  data: undefined,
  error: null,
  fetchedAt: null,
  seq: 0,
  lastAttemptFailed: false,
  pending: false,
});

const store = new Map();
const listeners = new Map();
const inflightPromises = new Map();
const seqCounters = new Map();

function notify(key) {
  const set = listeners.get(key);
  if (!set || set.size === 0) return;
  for (const fn of set) fn();
}

function nextSeq(key) {
  const n = (seqCounters.get(key) ?? 0) + 1;
  seqCounters.set(key, n);
  return n;
}

function getStorage() {
  return typeof globalThis.sessionStorage !== 'undefined' ? globalThis.sessionStorage : null;
}

function storageKeyFor(key) {
  return `${STORAGE_PREFIX}.v${CACHE_SCHEMA_VERSION}.${key}`;
}

function persistEntry(key, entry) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKeyFor(key), JSON.stringify({
      version: CACHE_SCHEMA_VERSION,
      data: entry.data,
      fetchedAt: entry.fetchedAt,
    }));
  } catch {
    /* best-effort — quota errors or non-serializable data shouldn't break the fetch */
  }
}

function removePersistedEntry(key) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKeyFor(key));
  } catch {
    /* ignore */
  }
}

/** Build the canonical cache key for a resource type scoped to a vehicle. */
export function makeResourceKey(resourceType, vehicleId) {
  return `${resourceType}:${vehicleId}`;
}

/** Current entry for key, or the shared EMPTY_ENTRY if nothing is cached yet. */
export function peekEntry(key) {
  if (key == null) return EMPTY_ENTRY;
  return store.get(key) ?? EMPTY_ENTRY;
}

/** Subscribe to changes for one key. Returns an unsubscribe function. */
export function subscribe(key, listener) {
  if (key == null) return () => {};
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

function setPending(key, value) {
  const prev = store.get(key) ?? EMPTY_ENTRY;
  if (prev.pending === value) return;
  store.set(key, { ...prev, pending: value });
  notify(key);
}

function applySuccess(key, seq, data, persist) {
  const prev = store.get(key) ?? EMPTY_ENTRY;
  if (seq < prev.seq) return; // an older response arrived after a newer one already applied
  const next = {
    ...prev,
    hasData: true,
    data,
    error: null,
    fetchedAt: Date.now(),
    seq,
    lastAttemptFailed: false,
  };
  store.set(key, next);
  if (persist) persistEntry(key, next);
  notify(key);
}

function applyError(key, seq, err) {
  const prev = store.get(key) ?? EMPTY_ENTRY;
  if (seq < prev.seq) return; // an older failure arrived after a newer response already applied
  store.set(key, { ...prev, error: err, seq, lastAttemptFailed: true });
  notify(key);
}

/**
 * Run (or join) a fetch for key.
 * - Concurrent callers without `force` share the same in-flight promise.
 * - `force: true` always starts a fresh, higher-sequence fetch (used after
 *   invalidate(), so a stale in-flight response can never win).
 * - Whichever response has the highest sequence number wins, regardless of
 *   network arrival order.
 */
export function fetchResource(key, fetcher, { force = false, persist = false } = {}) {
  if (!force) {
    const existing = inflightPromises.get(key);
    if (existing) return existing.promise;
  }

  const seq = nextSeq(key);
  setPending(key, true);

  const promise = Promise.resolve()
    .then(() => fetcher())
    .then(
      (data) => {
        applySuccess(key, seq, data, persist);
        return data;
      },
      (err) => {
        applyError(key, seq, err);
        throw err;
      },
    )
    .finally(() => {
      const current = inflightPromises.get(key);
      if (current && current.seq === seq) {
        inflightPromises.delete(key);
      }
      setPending(key, inflightPromises.has(key));
    });

  inflightPromises.set(key, { seq, promise });
  return promise;
}

/**
 * Seed a key with an already-known-fresh value (e.g. a mutation response
 * that returned the updated resource) without making a network call. Bumps
 * the sequence counter like a real fetch would, so it correctly supersedes
 * any fetch already in flight for this key.
 */
export function setEntryData(key, data, { persist = false } = {}) {
  const seq = nextSeq(key);
  applySuccess(key, seq, data, persist);
}

/**
 * Mark a cached entry stale and drop its persisted copy, without clearing
 * the in-memory data — consumers keep showing last-good data (now flagged
 * stale) until the next successful fetchResource() call replaces it.
 */
export function invalidate(key) {
  const prev = store.get(key);
  if (prev) {
    store.set(key, { ...prev, fetchedAt: null });
    notify(key);
  }
  removePersistedEntry(key);
}

/**
 * Populate the in-memory entry for `key` from sessionStorage, if enabled,
 * not already populated, and the persisted schema version still matches.
 * A version mismatch or corrupt payload discards the stored copy instead of
 * hydrating from it. No-op (returns null) when persistence isn't enabled or
 * there's nothing usable to hydrate.
 */
export function hydrateFromStorage(key, { persist = false } = {}) {
  if (!persist || key == null) return null;
  if (store.has(key)) return store.get(key);

  const storage = getStorage();
  if (!storage) return null;

  let raw;
  try {
    raw = storage.getItem(storageKeyFor(key));
  } catch {
    return null;
  }
  if (raw == null) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removePersistedEntry(key);
    return null;
  }

  if (!parsed || parsed.version !== CACHE_SCHEMA_VERSION) {
    removePersistedEntry(key);
    return null;
  }

  const entry = {
    ...EMPTY_ENTRY,
    hasData: true,
    data: parsed.data,
    fetchedAt: parsed.fetchedAt ?? null,
    seq: 0,
  };
  store.set(key, entry);
  notify(key);
  return entry;
}

/** True if a successfully-loaded entry is beyond its ttl, or its last refresh failed. */
export function isStale(entry, ttl) {
  if (!entry || !entry.hasData) return false;
  if (entry.lastAttemptFailed) return true;
  if (entry.fetchedAt == null) return true; // no timestamp (e.g. invalidate()'d) is always stale
  if (ttl == null) return false;
  return Date.now() - entry.fetchedAt > ttl;
}

/** Test-only: wipe all module state between test cases. Not for app use. */
export function __resetCacheForTests() {
  store.clear();
  listeners.clear();
  inflightPromises.clear();
  seqCounters.clear();
}
