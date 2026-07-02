/**
 * WebSocket events for operation session / fueling day updates.
 */

function serializeRefuel(refuel) {
  if (!refuel) return null;
  return refuel.toJSON ? refuel.toJSON() : refuel;
}

export function emitOperationRefuelEvent(io, eventName, payload) {
  if (!io?.sockets) return;
  const { sessionId, refuel, actorUserId, ...rest } = payload;
  const data = {
    sessionId: Number(sessionId),
    refuel: serializeRefuel(refuel),
    actorUserId,
    changedAt: new Date().toISOString(),
    ...rest,
  };
  io.to(`operation-session:${sessionId}`).emit(eventName, data);
  io.to('managers').emit(eventName, data);
}

export function emitOperationInvoiceReconciled(io, payload) {
  if (!io?.sockets) return;
  const data = {
    ...payload,
    changedAt: new Date().toISOString(),
  };
  if (payload.sessionId) {
    io.to(`operation-session:${payload.sessionId}`).emit('operation-invoice-reconciled', data);
  }
  io.to('managers').emit('operation-invoice-reconciled', data);
}

export function emitVehicleDocumentOcrCompleted(io, payload) {
  if (!io?.sockets) return;
  io.to('managers').emit('vehicle-document-ocr-completed', {
    ...payload,
    changedAt: new Date().toISOString(),
  });
}
