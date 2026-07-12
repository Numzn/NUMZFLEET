import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { fetchTraccarEventsAfterCursor } from '../integrations/traccarBridge/traccarEventQuery.js';
import { getReconciliationCursor, setReconciliationCursor } from '../integrations/traccarBridge/reconciliationCursorRepository.js';
import { processTelemetryEvent } from '../vehicleEngine/activity/telemetryIngestion.js';

const isDev = process.env.NODE_ENV === 'development';
const RECONCILIATION_LOCK_KEY = 84729104;
const ACTIVITY_EVENT_TYPES = new Set(['deviceonline', 'deviceoffline', 'devicemoving', 'devicestopped', 'deviceunknown']);

let tickInFlight = false;

async function tryAcquireAdvisoryLock() {
  const rows = await sequelize.query('SELECT pg_try_advisory_lock(:key) AS locked', {
    replacements: { key: RECONCILIATION_LOCK_KEY },
    type: QueryTypes.SELECT,
  });
  return rows[0]?.locked === true;
}

async function releaseAdvisoryLock() {
  await sequelize.query('SELECT pg_advisory_unlock(:key)', {
    replacements: { key: RECONCILIATION_LOCK_KEY },
    type: QueryTypes.SELECT,
  });
}

/**
 * Recovery-only safety net: re-scans tc_events on a slow cadence for
 * anything the event.forward.url webhook may have missed (e.g. a brief
 * outage on our side). Never the primary driver of activity state — the
 * webhook is. Reuses the same idempotency ledger, so anything the webhook
 * already processed is a no-op here.
 *
 * Env:
 *   TELEMETRY_RECONCILE_INTERVAL_MS — tick interval (default 3600000 / 1h). Set 0 to disable.
 *   TELEMETRY_RECONCILE_STARTUP_DELAY_MS — delay before first tick (default 30000).
 *   TELEMETRY_RECONCILE_LOOKBACK_HOURS — cold-start lookback if no cursor yet (default 6).
 */
export function startTelemetryReconciliationScheduler() {
  const raw = process.env.TELEMETRY_RECONCILE_INTERVAL_MS;
  const intervalMs = raw === undefined || raw === '' ? 3600000 : parseInt(raw, 10);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    if (isDev) console.log('[telemetryReconciliation] disabled (TELEMETRY_RECONCILE_INTERVAL_MS is 0 or invalid)');
    return () => {};
  }

  const startupDelay = Math.max(0, parseInt(process.env.TELEMETRY_RECONCILE_STARTUP_DELAY_MS ?? '30000', 10) || 0);
  const lookbackHours = Math.max(1, parseInt(process.env.TELEMETRY_RECONCILE_LOOKBACK_HOURS ?? '6', 10) || 6);

  const run = async () => {
    if (tickInFlight) return;
    tickInFlight = true;
    let lockAcquired = false;
    try {
      lockAcquired = await tryAcquireAdvisoryLock();
      if (!lockAcquired) return;

      const cursorId = await getReconciliationCursor();
      const events = await fetchTraccarEventsAfterCursor({ cursorId, lookbackHours, batchSize: 500 });
      let processed = 0;
      let maxId = cursorId;

      for (const row of events) {
        maxId = Math.max(maxId, Number(row.id));
        const type = String(row.type || '').toLowerCase();
        if (!ACTIVITY_EVENT_TYPES.has(type)) continue;
        await processTelemetryEvent({
          id: row.id,
          deviceId: row.deviceid,
          type: row.type,
          eventTime: row.eventtime,
        });
        processed += 1;
      }

      if (maxId > cursorId) await setReconciliationCursor(maxId);
      if (processed > 0) {
        console.log('[telemetryReconciliation] tick', { scanned: events.length, reconciled: processed, cursor: maxId });
      }
    } catch (err) {
      console.error('[telemetryReconciliation]', err?.message || err);
    } finally {
      if (lockAcquired) {
        try {
          await releaseAdvisoryLock();
        } catch (unlockErr) {
          console.error('[telemetryReconciliation] advisory unlock failed:', unlockErr?.message || unlockErr);
        }
      }
      tickInFlight = false;
    }
  };

  const startupTimer = setTimeout(() => { void run(); }, startupDelay);
  const intervalId = setInterval(() => { void run(); }, intervalMs);

  if (isDev) console.log(`[telemetryReconciliation] interval ${intervalMs}ms, first run in ${startupDelay}ms`);

  return () => {
    clearTimeout(startupTimer);
    clearInterval(intervalId);
  };
}
