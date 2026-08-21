import { logImmobilization } from './immobilizationLog.js';

/**
 * Runs a notification side effect without letting its failure change the
 * outcome of the state-changing operation that already committed. A
 * cancellation, expiry, or delivery finalize is done as soon as its DB
 * transition succeeds — notification (inbox write, websocket emit, SMS) is
 * best effort on top of that, never a condition of it.
 *
 * @param {(...args: any[]) => Promise<any>} fn
 * @param {...any} args
 */
export async function safeNotify(fn, ...args) {
  try {
    await fn(...args);
  } catch (error) {
    logImmobilization('immobilization.notify.failed', {
      error: error?.message || String(error),
    });
  }
}
