import { OperationSession } from '../models/index.js';
import { listBySessionId } from '../repositories/operationSessionRefuelRepository.js';
import { getLocksAt } from '../services/operationLockHelper.js';
import { resolveCalendarDateForOperation } from '../services/operationDayService.js';
import {
  notifyLockApproaching,
  notifyRecordingIncompleteAtLock,
} from '../services/operationNotificationService.js';
import { getFleetTimezone } from '../config/operationConfig.js';

let tickInFlight = false;
let intervalRef = null;

function isEnabled() {
  return String(process.env.OPERATION_LOCK_NOTIFICATIONS ?? '1') !== '0';
}

/**
 * Scan approved operations and, when they are within the lock-warning window,
 * alert the owner/managers that the operation locks soon and (if any vehicles
 * are still unrecorded) that recording is incomplete. Stable dedup keys make
 * each warning fire at most once per operation regardless of poll cadence.
 */
async function runOnce(now = new Date()) {
  const warningMs = Math.max(5, Number(process.env.OPERATION_LOCK_WARNING_MINUTES) || 60) * 60 * 1000;

  const operations = await OperationSession.findAll({ where: { status: 'approved' } });

  for (const operation of operations) {
    try {
      const tz = operation.fleetTimezone || getFleetTimezone();
      const cal = resolveCalendarDateForOperation(operation);
      const locksAt = getLocksAt(cal, tz).getTime();
      const remaining = locksAt - now.getTime();

      if (remaining <= 0 || remaining > warningMs) continue;

      const minutesRemaining = Math.max(1, Math.round(remaining / 60000));
      await notifyLockApproaching(operation, minutesRemaining);

      const refuels = await listBySessionId(operation.id);
      const total = refuels.length;
      const incomplete = refuels.filter((r) => r.actualFuelLitres == null).length;
      if (total > 0 && incomplete > 0) {
        await notifyRecordingIncompleteAtLock(operation, { incomplete, total });
      }
    } catch (e) {
      console.error('[operation-lock-notify] operation failed', operation?.id, e?.message || e);
    }
  }
}

export function startOperationLockNotificationScheduler() {
  if (!isEnabled()) {
    return () => {};
  }

  const pollMs = Math.max(60000, Number(process.env.OPERATION_LOCK_POLL_MS) || 300000);

  const tick = async () => {
    if (tickInFlight) return;
    tickInFlight = true;
    try {
      await runOnce();
    } catch (e) {
      console.error('[operation-lock-notify] poll failed', e?.message || e);
    } finally {
      tickInFlight = false;
    }
  };

  void tick();
  intervalRef = setInterval(tick, pollMs);

  return () => {
    if (intervalRef) {
      clearInterval(intervalRef);
      intervalRef = null;
    }
  };
}
