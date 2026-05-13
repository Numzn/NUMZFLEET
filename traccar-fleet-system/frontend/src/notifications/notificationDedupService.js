/** Default cooldown aligned with legacy fuel socket dedup (ms). */
export const DEFAULT_DEDUP_COOLDOWN_MS = 5000;

const seen = new Map();

/**
 * @param {string} key
 * @param {number} [ttlMs]
 * @returns {boolean} true if this key should be skipped (duplicate within cooldown)
 */
export function shouldSkipDedup(key, ttlMs = DEFAULT_DEDUP_COOLDOWN_MS) {
  if (!key) return false;
  const now = Date.now();
  const exp = seen.get(key);
  if (exp && exp > now) {
    return true;
  }
  seen.set(key, now + ttlMs);
  prune(now);
  return false;
}

function prune(now) {
  if (seen.size < 500) return;
  for (const [k, v] of seen) {
    if (v <= now) seen.delete(k);
  }
}

export function resetDedup() {
  seen.clear();
}
