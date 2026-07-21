import { dbErrorMessage } from './dbErrorMessage.js';

/**
 * Shared controller error responder: logs 5xx only (4xx are expected/user-caused),
 * translates the error via dbErrorMessage, and writes the JSON response.
 */
export function handleError(res, error, logLabel, fallback) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    console.error(`${logLabel}:`, error);
  }
  return res.status(status).json({ error: dbErrorMessage(error, fallback) });
}
