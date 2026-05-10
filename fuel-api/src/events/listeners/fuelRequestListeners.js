import eventBus from '../eventBus.js';
import { EVENT_NAMES } from '../eventNames.js';
import { withSafeListener } from '../safeListener.js';
import {
  emitFuelRequestCreated,
  emitFuelRequestUpdated,
  emitFuelRequestCancelled,
} from '../../fuelRequests/handlers/socketEvents.js';

/**
 * Register all listeners for the fuel request state machine.
 *
 * Each state transition has two listeners:
 *   1. socket-notify  — pushes the change to affected rooms via Socket.IO
 *   2. audit-log      — writes a structured log entry for the transition
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
};
