import moment from 'moment-timezone';
import { getFleetTimezone, getOperationLockGraceMinutes } from '../config/operationConfig.js';
import { findActiveUnlockForOperation } from '../repositories/operationUnlockRepository.js';
import { updateManyBySessionId } from '../repositories/operationSessionRefuelRepository.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from './auditEventService.js';

export function getTodayCalendarDate(fleetTimezone = getFleetTimezone()) {
  return moment.tz(fleetTimezone).format('YYYY-MM-DD');
}

export function calendarDateStart(calendarDate, fleetTimezone) {
  return moment.tz(calendarDate, 'YYYY-MM-DD', fleetTimezone).startOf('day');
}

export function getLocksAt(calendarDate, fleetTimezone = getFleetTimezone(), graceMinutes = getOperationLockGraceMinutes()) {
  const tz = fleetTimezone || getFleetTimezone();
  const dayStart = calendarDateStart(calendarDate, tz);
  return dayStart.clone().add(1, 'day').add(graceMinutes, 'minutes').toDate();
}

export function isPastLockTime(calendarDate, fleetTimezone, now = new Date(), graceMinutes = getOperationLockGraceMinutes()) {
  return now.getTime() > getLocksAt(calendarDate, fleetTimezone, graceMinutes).getTime();
}

export async function getActiveUnlock(operationId, now = new Date()) {
  return findActiveUnlockForOperation(operationId, now);
}

export async function isOperationWritable(operation, now = new Date()) {
  if (!operation) return false;

  // Check for an active unlock before the persisted-lock short-circuit —
  // otherwise a session whose status has already been lazily flipped to
  // 'locked' (which happens on virtually any read once past its cutoff)
  // can never become writable again, defeating the unlock feature.
  const unlock = await getActiveUnlock(operation.id, now);
  if (unlock) return true;

  if (operation.status === 'locked') return false;

  const tz = operation.fleetTimezone || getFleetTimezone();
  const cal = operation.calendarDate
    ? (typeof operation.calendarDate === 'string'
      ? operation.calendarDate
      : moment(operation.calendarDate).format('YYYY-MM-DD'))
    : getTodayCalendarDate(tz);

  return !isPastLockTime(cal, tz, now);
}

export async function effectiveOperationStatus(operation, now = new Date()) {
  if (!operation) return 'locked';

  const writable = await isOperationWritable(operation, now);
  if (!writable) return 'locked';

  if (operation.status === 'locked') {
    // Writable only because of an active unlock. No separate column stores
    // the pre-lock status, but approvedAt already tells us whether the
    // operation had been approved before it locked.
    return operation.approvedAt ? 'approved' : 'draft';
  }
  return operation.status;
}

export async function enrichOperationMeta(operation, now = new Date()) {
  const tz = operation.fleetTimezone || getFleetTimezone();
  const cal = operation.calendarDate
    ? (typeof operation.calendarDate === 'string'
      ? operation.calendarDate
      : moment(operation.calendarDate).format('YYYY-MM-DD'))
    : getTodayCalendarDate(tz);

  const locksAt = getLocksAt(cal, tz);
  const effectiveStatus = await effectiveOperationStatus(operation, now);
  const isWritable = effectiveStatus !== 'locked';

  return {
    calendarDate: cal,
    fleetTimezone: tz,
    locksAt: locksAt.toISOString(),
    effectiveStatus,
    isWritable,
    canRecordFuel: isWritable && effectiveStatus === 'approved',
    canEditForecast: isWritable && effectiveStatus === 'draft',
  };
}

export async function assertOperationWritable(operation, message = 'Operation is locked') {
  const writable = await isOperationWritable(operation);
  if (!writable) {
    const error = new Error(message);
    error.statusCode = 403;
    throw error;
  }
}

export async function maybePersistLock(operation, now = new Date()) {
  if (operation.status === 'locked') return operation;
  const effective = await effectiveOperationStatus(operation, now);
  if (effective !== 'locked') return operation;

  await operation.update({
    status: 'locked',
    lockedAt: operation.lockedAt || now,
    totalsFrozenAt: operation.totalsFrozenAt || now,
  });
  await updateManyBySessionId(operation.id, { locked: true });
  await recordAuditEvent(operation.id, AUDIT_EVENT_TYPES.OPERATION_LOCKED, null, {
    lockedAt: (operation.lockedAt || now).toISOString?.() || now,
  });
  return operation;
}
