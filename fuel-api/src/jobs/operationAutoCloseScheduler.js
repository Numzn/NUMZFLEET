import { Op } from 'sequelize';
import { OperationSession } from '../models/index.js';
import { maybePersistLock } from '../services/operationLockHelper.js';

let tickInFlight = false;
let intervalRef = null;

function isEnabled() {
  return String(process.env.OPERATION_AUTO_CLOSE ?? '1') !== '0';
}

/**
 * Sessions only get their DB `status` flipped to 'locked' lazily, the next
 * time some other request happens to touch them (maybePersistLock). If an
 * operator forgets to close a Fueling Day and nobody revisits it, it stays
 * 'approved' in the DB forever even though it's long past its lock cutoff.
 * This sweep proactively persists the lock so only today's session (or one
 * under an active supervisor unlock) can remain non-locked.
 */
async function runOnce(now = new Date()) {
  const operations = await OperationSession.findAll({
    where: { status: { [Op.in]: ['draft', 'approved'] } },
  });

  for (const operation of operations) {
    try {
      await maybePersistLock(operation, now);
    } catch (e) {
      console.error('[operation-auto-close] operation failed', operation?.id, e?.message || e);
    }
  }
}

export function startOperationAutoCloseScheduler() {
  if (!isEnabled()) {
    return () => {};
  }

  const pollMs = Math.max(60000, Number(process.env.OPERATION_AUTO_CLOSE_POLL_MS) || 300000);

  const tick = async () => {
    if (tickInFlight) return;
    tickInFlight = true;
    try {
      await runOnce();
    } catch (e) {
      console.error('[operation-auto-close] poll failed', e?.message || e);
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
