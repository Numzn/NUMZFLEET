/**
 * WebSocket events for operation session / fueling day updates.
 */

export function emitVehicleDocumentOcrCompleted(io, payload) {
  if (!io?.sockets) return;
  io.to('managers').emit('vehicle-document-ocr-completed', {
    ...payload,
    changedAt: new Date().toISOString(),
  });
}
