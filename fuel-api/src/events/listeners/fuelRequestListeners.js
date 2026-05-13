import eventBus from '../eventBus.js';
import { EVENT_NAMES } from '../eventNames.js';
import { withSafeListener } from '../safeListener.js';
import {
  emitFuelRequestCreated,
  emitFuelRequestUpdated,
  emitFuelRequestCancelled,
} from '../../fuelRequests/handlers/socketEvents.js';
import { persistFuelSocketEvent } from '../../modules/notifications/notificationService.js';

/**
 * Register all listeners for the fuel request state machine.
 *
 * Each state transition has listeners for:
 *   1. socket-notify  — pushes the change to affected rooms via Socket.IO
 *   2. audit-log      — writes a structured log entry for the transition
 *   3. persist-notification — stores rows for notification center (PostgreSQL)
 *
 * Listeners are wrapped in withSafeListener so a failure in one (e.g. a broken
 * socket) cannot crash the API response or prevent the audit log from running.
 */
export const registerFuelRequestListeners = (io) => {

  // ─── fuel.request.created ────────────────────────────────────────────────

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_CREATED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_CREATED, 'socket-notify-managers', ({ request, actorUserId }) => {
      emitFuelRequestCreated(io, request, actorUserId);
    }),
  );

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_CREATED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_CREATED, 'audit-log', ({ request, actorUserId }) => {
      console.log('[audit] fuel.request.created', {
        requestId: request.id,
        deviceId: request.deviceId,
        driverId: request.userId,
        requestedAmount: request.requestedAmount,
        urgency: request.urgency,
        actorUserId,
        at: new Date().toISOString(),
      });
    }),
  );

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_CREATED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_CREATED, 'persist-notification', async ({ request, actorUserId }) => {
      const changedAt = new Date().toISOString();
      await persistFuelSocketEvent({
        kind: 'created',
        request,
        change: {
          type: 'created',
          changedAt,
          message: `New fuel request for ${request.requestedAmount}L from device ${request.deviceId}`,
        },
        actorUserId,
      });
    }),
  );

  // ─── fuel.request.approved ───────────────────────────────────────────────

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_APPROVED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_APPROVED, 'socket-notify', ({ request, previousStatus, actorUserId, message }) => {
      emitFuelRequestUpdated(io, request, 'approved', previousStatus, actorUserId, message);
    }),
  );

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_APPROVED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_APPROVED, 'audit-log', ({ request, previousStatus, actorUserId }) => {
      console.log('[audit] fuel.request.approved', {
        requestId: request.id,
        driverId: request.userId,
        approvedAmount: request.approvedAmount,
        previousStatus,
        actorUserId,
        // ── Locked pricing snapshot ──
        lockedPricePerUnit:    request.lockedPricePerUnit,
        lockedCurrency:        request.lockedCurrency,
        lockedFuelType:        request.lockedFuelType,
        lockedApprovedCost:    request.lockedApprovedCost,
        priceSourceAtApproval: request.priceSourceAtApproval,
        priceAuditTimestamp:   request.priceAuditTimestamp,
        at: new Date().toISOString(),
      });
    }),
  );

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_APPROVED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_APPROVED, 'persist-notification', async ({ request, previousStatus, actorUserId, message }) => {
      await persistFuelSocketEvent({
        kind: 'updated',
        request,
        change: {
          type: 'approved',
          previousStatus,
          newStatus: request.status,
          changedBy: actorUserId,
          changedAt: new Date().toISOString(),
          message,
        },
        actorUserId,
      });
    }),
  );

  // ─── fuel.request.fulfilled ──────────────────────────────────────────────

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_FULFILLED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_FULFILLED, 'socket-notify', ({ request, previousStatus, actorUserId }) => {
      emitFuelRequestUpdated(io, request, 'fulfilled', previousStatus, actorUserId);
    }),
  );

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_FULFILLED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_FULFILLED, 'audit-log', ({ request, previousStatus, actorUserId }) => {
      console.log('[audit] fuel.request.fulfilled', {
        requestId: request.id,
        driverId: request.userId,
        approvedAmount: request.approvedAmount,
        previousStatus,
        actorUserId,
        // ── Reconciliation vs locked snapshot ──
        lockedApprovedCost:   request.lockedApprovedCost,
        actualFulfilledAmount: request.actualFulfilledAmount,
        actualFulfilledCost:   request.actualFulfilledCost,
        variance: request.actualFulfilledCost != null && request.lockedApprovedCost != null
          ? Number((request.actualFulfilledCost - request.lockedApprovedCost).toFixed(2))
          : null,
        at: new Date().toISOString(),
      });
    }),
  );

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_FULFILLED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_FULFILLED, 'persist-notification', async ({ request, previousStatus, actorUserId }) => {
      await persistFuelSocketEvent({
        kind: 'updated',
        request,
        change: {
          type: 'fulfilled',
          previousStatus,
          newStatus: request.status,
          changedBy: actorUserId,
          changedAt: new Date().toISOString(),
        },
        actorUserId,
      });
    }),
  );

  // ─── fuel.request.rejected ───────────────────────────────────────────────

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_REJECTED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_REJECTED, 'socket-notify', ({ request, previousStatus, actorUserId, message }) => {
      emitFuelRequestUpdated(io, request, 'rejected', previousStatus, actorUserId, message);
    }),
  );

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_REJECTED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_REJECTED, 'audit-log', ({ request, previousStatus, actorUserId }) => {
      console.log('[audit] fuel.request.rejected', {
        requestId: request.id,
        driverId: request.userId,
        notes: request.notes,
        previousStatus,
        actorUserId,
        at: new Date().toISOString(),
      });
    }),
  );

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_REJECTED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_REJECTED, 'persist-notification', async ({ request, previousStatus, actorUserId, message }) => {
      await persistFuelSocketEvent({
        kind: 'updated',
        request,
        change: {
          type: 'rejected',
          previousStatus,
          newStatus: request.status,
          changedBy: actorUserId,
          changedAt: new Date().toISOString(),
          message,
        },
        actorUserId,
      });
    }),
  );

  // ─── fuel.request.cancelled ──────────────────────────────────────────────

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_CANCELLED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_CANCELLED, 'socket-notify', ({ request, previousStatus, actorUserId }) => {
      emitFuelRequestCancelled(io, request, previousStatus, actorUserId);
    }),
  );

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_CANCELLED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_CANCELLED, 'audit-log', ({ request, previousStatus, actorUserId }) => {
      console.log('[audit] fuel.request.cancelled', {
        requestId: request.id,
        driverId: request.userId,
        previousStatus,
        actorUserId,
        at: new Date().toISOString(),
      });
    }),
  );

  eventBus.on(
    EVENT_NAMES.FUEL_REQUEST_CANCELLED,
    withSafeListener(EVENT_NAMES.FUEL_REQUEST_CANCELLED, 'persist-notification', async ({ request, previousStatus, actorUserId }) => {
      await persistFuelSocketEvent({
        kind: 'updated',
        request,
        change: {
          type: 'cancelled',
          previousStatus,
          newStatus: request.status,
          changedBy: actorUserId,
          changedAt: new Date().toISOString(),
          message: `Fuel request #${request.id} cancelled`,
        },
        actorUserId,
      });
    }),
  );
};
