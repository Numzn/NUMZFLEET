import { processTelemetryEvent } from '../vehicleEngine/activity/telemetryIngestion.js';

/**
 * Single seam between "an event arrived" and "the event gets processed".
 * Today: fire-and-forget off the event loop so the HTTP handler can return
 * immediately. Swapping in a real broker (BullMQ/Redis) later means changing
 * only this function's internals — callers and processTelemetryEvent's
 * signature stay the same.
 */
export function enqueue(rawEvent) {
  setImmediate(() => {
    processTelemetryEvent(rawEvent).catch((err) => {
      console.error('[telemetryQueue] processing failed unexpectedly', err?.message || err);
    });
  });
}
