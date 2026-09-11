/**
 * WebSocket events for operation session / fueling day updates.
 */

import { managersRoom } from '../../socket/rooms.js';

/**
 * Broadcast to the owning company's managers only.
 *
 * This previously went to a single global `managers` room, so every manager of
 * every company received another company's vehicle document results. The
 * payload already carries companyId (see vehicleDocumentOcrService.js), so
 * scoping needs no extra plumbing.
 *
 * Fails closed: a payload with no company is dropped rather than broadcast
 * widely, because "we do not know who owns this" can never mean "send it to
 * everyone" (docs/TENANCY_ARCHITECTURE.md §1).
 */
export function emitVehicleDocumentOcrCompleted(io, payload) {
  if (!io?.sockets) return;

  const room = managersRoom(payload?.companyId);
  if (!room) {
    console.warn('[operationSocketEvents] vehicle-document-ocr-completed dropped: no companyId on payload');
    return;
  }

  io.to(room).emit('vehicle-document-ocr-completed', {
    ...payload,
    changedAt: new Date().toISOString(),
  });
}
