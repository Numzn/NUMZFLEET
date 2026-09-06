import { getManagerUserIds } from '../../services/userService.js';

function uniqIds(ids) {
  return [...new Set(ids.filter((x) => Number.isFinite(Number(x))).map((x) => Number(x)))];
}

/**
 * @param {import('../contracts/notificationContract.js').NotificationAudience} audience
 * @param {string|null} [companyId] the notification's own explicit company
 *   (never the DEFAULT_COMPANY_ID fallback) — scopes a managers:true audience
 *   to that company's own managers. Omit to notify every manager instance-wide,
 *   unchanged from before this parameter existed.
 */
export async function resolveAudience(audience = {}, companyId = null) {
  if (Array.isArray(audience.userIds) && audience.userIds.length) {
    return uniqIds(audience.userIds);
  }

  const managerIds = audience.managers || audience.includeDriverWithManagers
    ? await getManagerUserIds(companyId)
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
