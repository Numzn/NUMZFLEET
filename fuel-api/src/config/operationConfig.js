export function getFleetTimezone() {
  return process.env.FLEET_TIMEZONE || 'Africa/Lusaka';
}

export function getOperationLockGraceMinutes() {
  const n = Number(process.env.OPERATION_LOCK_GRACE_MINUTES ?? 15);
  return Number.isFinite(n) && n >= 0 ? n : 15;
}

export default {
  getFleetTimezone,
  getOperationLockGraceMinutes,
};
