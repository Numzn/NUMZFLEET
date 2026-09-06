const SOCKET_EVENT = 'notification.created';

/**
 * @param {import('socket.io').Server} io
 * @param {number} userId
 * @param {object} payload
 */
export function deliverWebsocketNotification(io, userId, payload) {
  if (!io?.sockets || userId == null) return { ok: false, reason: 'no_socket_server' };
  io.to(`user-${userId}`).emit(SOCKET_EVENT, payload);
  // Emitted, not confirmed — socket.io gives no receipt, so this is 'sent'
  // rather than 'delivered'. Callers that ignore the return value are
  // unaffected; this exists so deliveries can be recorded honestly.
  return { ok: true };
}

export { SOCKET_EVENT };
