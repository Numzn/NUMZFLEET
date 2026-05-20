import { getManagerUserIds } from '../../services/userService.js';

function uniqIds(ids) {
  return [...new Set(ids.filter((x) => Number.isFinite(Number(x))).map((x) => Number(x)))];
}

/**
 * @param {import('../contracts/notificationContract.js').NotificationAudience} audience
 */
export async function resolveAudience(audience = {}) {
  if (Array.isArray(audience.userIds) && audience.userIds.length) {
    return uniqIds(audience.userIds);
  }

  const managerIds = audience.managers || audience.includeDriverWithManagers
    ? await getManagerUserIds()
    : [];

  if (audience.includeDriverWithManagers && audience.driverId != null) {
    return uniqIds([Number(audience.driverId), ...managerIds]);
  }

  if (audience.managers) {
    return managerIds;
  }

  if (audience.driverId != null) {
    return uniqIds([Number(audience.driverId)]);
  }

  return [];
}
