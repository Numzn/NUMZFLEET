/**
 * Structured diagnostics logger.
 *
 * - In development: emits compact JSON via console.debug.
 * - In production: silent unless localStorage.NUMZ_DIAG === '1'.
 *
 * User-facing copy must NEVER come from this logger; it is for engineers and
 * power users debugging connectivity / socket / API behavior.
 */

const STORAGE_KEY = 'NUMZ_DIAG';

function isDev() {
  try {
    return !!(import.meta && import.meta.env && import.meta.env.DEV);
  } catch {
    return false;
  }
}

function isOptedIn() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function shouldEmit() {
  return isDev() || isOptedIn();
}

function emit(level, type, payload) {
  if (!shouldEmit()) return;
  const event = {
    ts: new Date().toISOString(),
    type,
    ...(payload && typeof payload === 'object' ? payload : { value: payload }),
  };
  const fn = (typeof console !== 'undefined' && console[level]) || console.log;
  try {
    fn.call(console, '[diag]', event);
  } catch {
    // Never let logging crash the app.
  }
}

export const diag = {
  log: (type, payload) => emit('debug', type, payload),
  info: (type, payload) => emit('info', type, payload),
  warn: (type, payload) => emit('warn', type, payload),
  error: (type, payload) => emit('error', type, payload),
  enabled: shouldEmit,
};

export default diag;
