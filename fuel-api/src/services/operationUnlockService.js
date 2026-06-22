import {
  findById as findSessionById,
} from '../repositories/operationSessionRepository.js';
import { createUnlock } from '../repositories/operationUnlockRepository.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from './auditEventService.js';
import { assertCanAccessSession, toSessionDto } from './operationSessionCore.js';
import { enrichOperationMeta } from './operationLockHelper.js';
import { notifyOperationUnlocked } from './operationNotificationService.js';

export async function unlockOperation(user, sessionId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);

  const durationMinutes = Math.min(Math.max(Number(payload.durationMinutes) || 30, 5), 240);
  const reason = payload.reason ? String(payload.reason).trim() : null;

  if (!reason) {
    const error = new Error('reason is required');
    error.statusCode = 400;
    throw error;
  }

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  await createUnlock(session.id, user.id, expiresAt, reason);

  await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.OPERATION_UNLOCKED, user.id, {
    durationMinutes,
    expiresAt: expiresAt.toISOString(),
    reason,
  });

  const fresh = await findSessionById(sessionId);
  const dto = await toSessionDto(fresh);
  const meta = await enrichOperationMeta(fresh);

  await notifyOperationUnlocked(fresh, user.id, {
    expiresAt: expiresAt.toISOString(),
    reason,
  });

  return { ...dto, unlockExpiresAt: expiresAt.toISOString(), isWritable: meta.isWritable };
}
