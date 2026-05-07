/**
 * apiFetch
 * --------
 * Centralized HTTP client built on top of fetch with:
 *   - timeout via AbortController
 *   - opt-in retry with exponential backoff + jitter
 *   - offline short-circuit (uses ConnectivityService)
 *   - normalized errors (apiErrors.js)
 *   - same auth-redirect behavior as legacy fetchOrThrow.js (Traccar 401)
 *   - structured diag logs for failures and retries
 *
 * This module is ADDITIVE. Existing fetchOrThrow callers are not migrated;
 * new code should prefer apiFetch.
 */

import { isFuelApiPath } from '../../config/traccarApi.js';
import ConnectivityService from '../../connectivity/ConnectivityService.js';
import diag from './diagLogger.js';
import {
  ApiError,
  AuthError,
  OfflineError,
  TimeoutError,
  translateError,
  translateResponse,
} from './apiErrors.js';

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRY_DELAY_MS = 4000;

function pathnameFromInput(input) {
  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      try { return new URL(input).pathname; } catch { return input.split('?')[0]; }
    }
    return input.split('?')[0];
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    try { return new URL(input.url).pathname; } catch { return ''; }
  }
  return '';
}

function isNonTraccarUnauthorizedPath(path) {
  if (!path) return false;
  if (isFuelApiPath(path)) return true;
  if (path.startsWith('/socket.io')) return true;
  return false;
}

function handleUnauthorizedRedirect() {
  if (typeof window === 'undefined') return;
  const current = `${window.location.pathname}${window.location.search}`;
  try { window.sessionStorage.setItem('postLogin', current); } catch { /* noop */ }
  window.location.replace('/login');
}

function backoffDelay(attempt) {
  const exp = Math.min(DEFAULT_MAX_RETRY_DELAY_MS, 300 * Math.pow(2, attempt));
  const jitter = Math.random() * 200;
  return Math.floor(exp + jitter);
}

function chainAbort(externalSignal, internalController) {
  if (!externalSignal) return () => {};
  if (externalSignal.aborted) {
    internalController.abort();
    return () => {};
  }
  const onAbort = () => internalController.abort();
  externalSignal.addEventListener('abort', onAbort, { once: true });
  return () => externalSignal.removeEventListener('abort', onAbort);
}

function safeNow() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now();
  return Date.now();
}

/**
 * Perform a single fetch attempt with timeout. Returns Response on success,
 * throws normalized ApiError on failure.
 */
async function attempt(input, init, timeoutMs) {
  const controller = new AbortController();
  const detach = chainAbort(init.signal, controller);
  let timedOut = false;
  // Track timeout vs caller-driven abort: set the flag *before* aborting so
  // the catch branch can label this as TimeoutError reliably.
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const start = safeNow();

  try {
    const response = await fetch(input, {
      credentials: 'include',
      ...init,
      signal: controller.signal,
    });
    const latency = Math.round(safeNow() - start);
    return { response, latency };
  } catch (err) {
    throw translateError(err, { timedOut });
  } finally {
    clearTimeout(timer);
    detach();
  }
}

/**
 * @param {string|Request} input
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=15000]
 * @param {number} [options.retries=0]
 * @param {Array<Function>} [options.retryOn] - subset of [OfflineError, TimeoutError, ServerError]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.redirectOnUnauthorized=true]
 * @param {boolean} [options.parseJson=false]  - when true returns parsed JSON; else Response
 * @returns {Promise<Response|any>}
 */
export default async function apiFetch(input, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    retryOn,
    signal,
    redirectOnUnauthorized = true,
    parseJson = false,
    ...fetchInit
  } = options;

  const path = pathnameFromInput(input);
  const url = typeof input === 'string' ? input : (input && input.url) || path;

  // Offline short-circuit — fail fast and don't burn retries when we know
  // the browser is offline. Skip if caller wants offline behavior to be the
  // network's job by passing retries === 0 and timeoutMs === 0 (rare).
  const snap = ConnectivityService.getSnapshot();
  if (!snap.isBrowserOnline) {
    const err = new OfflineError('You appear to be offline.', `offline pre-flight: ${url}`);
    diag.warn('api_offline_shortcircuit', { url, path });
    throw err;
  }

  const retryClasses = Array.isArray(retryOn) && retryOn.length > 0 ? retryOn : null;
  const maxAttempts = Math.max(0, Number(retries) | 0) + 1;

  let lastError = null;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const { response, latency } = await attempt(input, { ...fetchInit, signal }, timeoutMs);

      if (!response.ok) {
        // Read body once for diagnostics + error text.
        let bodyText = '';
        try { bodyText = await response.text(); } catch { /* noop */ }

        const apiErr = translateResponse(response, bodyText);

        // Preserve fetchOrThrow's redirect behavior for Traccar 401s only.
        if (
          apiErr instanceof AuthError &&
          response.status === 401 &&
          redirectOnUnauthorized &&
          !isNonTraccarUnauthorizedPath(path)
        ) {
          handleUnauthorizedRedirect();
        }

        ConnectivityService.notifyFailure(apiErr);
        diag.warn('api_response_error', {
          url, path, status: response.status, code: apiErr.code, attempt: i + 1, latency,
        });

        if (apiErr.retriable && retryClasses && retryClasses.some((cls) => apiErr instanceof cls) && i < maxAttempts - 1) {
          const delay = backoffDelay(i);
          diag.log('api_retry', { url, code: apiErr.code, nextDelay: delay, attempt: i + 1 });
          await new Promise((r) => setTimeout(r, delay));
          lastError = apiErr;
          continue;
        }

        throw apiErr;
      }

      ConnectivityService.notifySuccess(latency);

      if (parseJson) {
        try {
          return await response.json();
        } catch (err) {
          throw translateError(err, { timedOut: false });
        }
      }
      return response;
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : translateError(err);
      lastError = apiErr;

      // Notify connectivity for true network/timeout errors.
      if (apiErr instanceof OfflineError || apiErr instanceof TimeoutError) {
        ConnectivityService.notifyFailure(apiErr);
      }

      diag.warn('api_attempt_failed', {
        url, path, code: apiErr.code, status: apiErr.status, attempt: i + 1,
      });

      const canRetry = apiErr.retriable && i < maxAttempts - 1
        && (!retryClasses || retryClasses.some((cls) => apiErr instanceof cls));
      if (canRetry) {
        const delay = backoffDelay(i);
        diag.log('api_retry', { url, code: apiErr.code, nextDelay: delay, attempt: i + 1 });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw apiErr;
    }
  }

  throw lastError || new ApiError('UnknownError', 'UNKNOWN', 'Request failed.', 'no attempts succeeded', 0);
}

export { apiFetch };
