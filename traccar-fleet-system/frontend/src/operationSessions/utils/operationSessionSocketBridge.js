export const OPERATION_SESSION_SOCKET_EVENT = 'numzfleet:operation-session-update';

export function dispatchOperationSessionUpdate(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPERATION_SESSION_SOCKET_EVENT, { detail }));
}
