/**
 * Socket.IO room membership — the one place that decides which rooms a
 * connection may join, and which room an event may be broadcast to.
 *
 * Kept pure and separate from socketHandler.js on purpose: this is a tenancy
 * decision (docs/TENANCY_ARCHITECTURE.md §7), so it must be provable in tests
 * without standing up a socket server.
 *
 * Manager rooms are company-scoped. They used to be a single global
 * `managers` room shared by every manager of every company, which meant any
 * broadcast to it crossed company boundaries — `vehicle-document-ocr-completed`
 * was doing exactly that.
 *
 * Membership is always server-assigned from the identity's resolved company.
 * A client never asks to join a room, and nothing here reads anything the
 * client controls.
 */

export const PLATFORM_MANAGERS_ROOM = 'managers:platform';

/**
 * Room for a company's managers, or null when there is no company to scope to.
 * Null is a refusal, not a fallback: a broadcast with no resolvable company
 * must not go anywhere rather than go to everyone.
 */
export function managersRoom(companyId) {
  const id = companyId == null ? '' : String(companyId).trim();
  return id ? `managers:${id}` : null;
}

/**
 * Platform-scoped identities get their own room, never a customer company's.
 * Platform capability is a management surface, not membership of every tenant —
 * a platform admin does not silently receive customer operational traffic.
 */
export function resolveManagerRoom({ isManager = false, isPlatform = false, companyId = null } = {}) {
  if (isPlatform) return PLATFORM_MANAGERS_ROOM;
  if (!isManager) return null;
  return managersRoom(companyId);
}

/**
 * Every room a connection should join. Personal rooms are keyed by the
 * authenticated user id and carry no company dimension by design — they are
 * addressed to one identity, so they cannot cross a tenant boundary.
 */
export function roomsForSocket({
  userId = null, isManager = false, isPlatform = false, companyId = null,
} = {}) {
  const rooms = [];

  const managerRoom = resolveManagerRoom({ isManager, isPlatform, companyId });
  if (managerRoom) rooms.push(managerRoom);

  if (userId != null && userId !== '') {
    rooms.push(`driver-${userId}`);
    rooms.push(`user-${userId}`);
  }

  return rooms;
}
