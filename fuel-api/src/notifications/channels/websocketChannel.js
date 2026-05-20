const SOCKET_EVENT = 'notification.created';

/**
 * @param {import('socket.io').Server} io
 * @param {number} userId
 * @param {object} payload
 */
export function deliverWebsocketNotification(io, userId, payload) {
  if (!io?.sockets || userId == null) return;
  io.to(`user-${userId}`).emit(SOCKET_EVENT, payload);
}

export { SOCKET_EVENT };
