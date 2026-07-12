import { enqueue } from '../ingestion/telemetryQueue.js';

/**
 * POST /internal/telemetry/traccar-events
 * Body: a single Traccar forwarded event ({ event: {...}, position, device }).
 * Enqueues and returns immediately — all processing happens off this request.
 */
export function ingestTraccarEvent(req, res) {
  enqueue(req.body);
  res.status(202).json({ accepted: true });
}
