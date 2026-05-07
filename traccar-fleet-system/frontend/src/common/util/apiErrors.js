/**
 * Normalized API error classes + a translator that maps low-level fetch /
 * HTTP signals into one of these classes.
 *
 * Each error carries:
 *   - status            HTTP status when applicable, else 0
 *   - code              short machine code (e.g. "OFFLINE")
 *   - technicalMessage  raw message useful for diagnostics
 *   - userMessage       short user-friendly copy safe to display
 *   - cause             original error (for diag), if any
 *   - retriable         boolean hint for callers
 */

class ApiError extends Error {
  constructor(name, code, userMessage, technicalMessage, status = 0, options = {}) {
    super(technicalMessage || userMessage);
    this.name = name;
    this.code = code;
    this.status = status;
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage || userMessage;
    this.cause = options.cause;
    this.retriable = !!options.retriable;
  }
}

export class OfflineError extends ApiError {
  constructor(userMessage = 'You appear to be offline.', technicalMessage, options = {}) {
    super('OfflineError', 'OFFLINE', userMessage, technicalMessage, 0, { ...options, retriable: true });
  }
}

export class TimeoutError extends ApiError {
  constructor(userMessage = 'Request timed out. Please try again.', technicalMessage, options = {}) {
    super('TimeoutError', 'TIMEOUT', userMessage, technicalMessage, 0, { ...options, retriable: true });
  }
}

export class ServerError extends ApiError {
  constructor(status = 500, userMessage = 'Server temporarily unavailable.', technicalMessage, options = {}) {
    super('ServerError', 'SERVER', userMessage, technicalMessage, status, { ...options, retriable: true });
  }
}

export class AuthError extends ApiError {
  constructor(status = 401, userMessage = 'You need to sign in again.', technicalMessage, options = {}) {
    super('AuthError', 'AUTH', userMessage, technicalMessage, status, { ...options, retriable: false });
  }
}

export class ValidationError extends ApiError {
  constructor(status = 400, userMessage = 'Request was rejected by the server.', technicalMessage, options = {}) {
    super('ValidationError', 'VALIDATION', userMessage, technicalMessage, status, { ...options, retriable: false });
  }
}

export class UnknownError extends ApiError {
  constructor(userMessage = 'Something went wrong.', technicalMessage, options = {}) {
    super('UnknownError', 'UNKNOWN', userMessage, technicalMessage, 0, { ...options, retriable: false });
  }
}

function isAbortError(err) {
  return !!err && (err.name === 'AbortError' || err.code === 20);
}

function isTypeErrorFailedFetch(err) {
  if (!err) return false;
  if (err.name !== 'TypeError') return false;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  );
}

function browserOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * Map any thrown error or HTTP response into a normalized ApiError.
 *
 * Usage:
 *   try { ... } catch (err) { throw translateError(err); }
 *   const apiErr = translateResponse(response, bodyText);
 */
export function translateError(err, context = {}) {
  if (err instanceof ApiError) return err;

  if (isAbortError(err)) {
    if (context.timedOut) {
      return new TimeoutError('Request timed out. Please try again.', err.message, { cause: err });
    }
    return new TimeoutError('Request was cancelled.', err.message, { cause: err });
  }

  if (isTypeErrorFailedFetch(err)) {
    if (!browserOnline()) {
      return new OfflineError('You appear to be offline.', err.message, { cause: err });
    }
    return new OfflineError('Cannot reach server. Connection interrupted.', err.message, { cause: err });
  }

  if (err && typeof err.message === 'string') {
    const msg = err.message.toLowerCase();
    if (msg.includes('err_connection_reset') || msg.includes('econnreset')) {
      return new OfflineError('Connection interrupted.', err.message, { cause: err });
    }
    if (msg.includes('timeout')) {
      return new TimeoutError('Request timed out. Please try again.', err.message, { cause: err });
    }
  }

  return new UnknownError('Something went wrong.', err && err.message, { cause: err });
}

/**
 * Translate a non-ok Response into a normalized ApiError. The caller is
 * responsible for reading the body (so we do not consume it twice).
 */
export function translateResponse(response, bodyText = '') {
  const status = response && typeof response.status === 'number' ? response.status : 0;
  const tech = bodyText || (response && response.statusText) || `HTTP ${status}`;

  if (status >= 500) {
    return new ServerError(status, 'Server temporarily unavailable.', tech);
  }
  if (status === 401 || status === 403) {
    return new AuthError(status, status === 401 ? 'You need to sign in again.' : 'You do not have access.', tech);
  }
  if (status === 408 || status === 504) {
    return new TimeoutError('Request timed out. Please try again.', tech);
  }
  if (status >= 400) {
    return new ValidationError(status, 'Request was rejected by the server.', tech);
  }
  return new UnknownError('Unexpected server response.', tech);
}

export { ApiError };
