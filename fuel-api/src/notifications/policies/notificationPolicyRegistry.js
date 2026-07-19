/**
 * Central notification policy registry — Phase 1 of the notification
 * architecture cleanup. Generalizes the pattern already proven by
 * notificationPolicyService.js (Traccar tracking events) to the other 10
 * publishNotification() producers, so severity/audience/channel/dedup
 * decisions live in one place instead of being hardcoded separately in 9
 * different files.
 *
 * PURE REFACTOR — every entry here reproduces EXISTING behavior exactly,
 * verified against the live call sites this session. This is not the place
 * to "fix" anything that looks odd (e.g. the two intentionally-non-
 * deterministic dedup keys below) — that's later phases' job.
 *
 * Deliberately excluded from every entry's schema (stay call-site-local,
 * spread directly into the publishNotification() call, never touched here):
 *   - entityId    (all 11 call sites already pass this explicitly)
 *   - companyId   (only 3 call sites use this: compliance, maintenance x2)
 *   - source      (only 2 call sites override this: traccar, erb)
 * Baking any of these into the registry risks silently dropping or
 * overriding a value a specific call site relies on.
 *
 * Traccar tracking events are NOT represented here — resolveTraccarTrackingPolicy()
 * in ./notificationPolicyService.js stays exactly as-is; it decides from raw
 * external event data with a different signature and a different channel
 * vocabulary ('bell'/'push' strings), and folding it into this registry's
 * shape would be a lossy translation for no benefit.
 */

import { CHANNELS } from '../contracts/notificationContract.js';
import { localDateString } from '../../utils/businessDay.js';
import { buildFuelDedupKey, buildEscalationDedupKey } from '../../modules/notifications/notificationService.js';
import { severityForStatus, PUBLISH_STATUS } from '../immobilizationNotificationService.js';

// Reused verbatim so this registry has exactly one place that knows the
// "always fresh, never dedup" pattern's shape, for the two producers that
// deliberately use it (manual escalation, operation-unlock).
export { buildFuelDedupKey, buildEscalationDedupKey, severityForStatus, PUBLISH_STATUS };

const STANDARD_CHANNELS = [CHANNELS.INBOX, CHANNELS.WEBSOCKET];

// ---------------------------------------------------------------------------
// #1 Fuel request lifecycle (notificationService.js — persistFuelSocketEvent)
// ---------------------------------------------------------------------------

function fuelRequestSeverity(changeType, request) {
  if (changeType === 'created') {
    return request?.urgency === 'emergency' ? 'critical' : 'warning';
  }
  if (changeType === 'approved' || changeType === 'fulfilled') return 'success';
  if (changeType === 'rejected' || changeType === 'cancelled') return 'warning';
  return 'info';
}

function fuelRequestAudience(kind, request) {
  return kind === 'created'
    ? { managers: true }
    : { includeDriverWithManagers: true, driverId: Number(request.userId) };
}

export function fuelRequestPolicy({ kind, changeType, request }) {
  return {
    type: `fuel.request.${changeType}`,
    entityType: 'fuel',
    severity: fuelRequestSeverity(changeType, request),
    audience: fuelRequestAudience(kind, request),
    channels: STANDARD_CHANNELS,
    clientDedupKey: buildFuelDedupKey(request.id, changeType),
  };
}

// ---------------------------------------------------------------------------
// #2 Manual tracking escalation (notificationService.js — escalateVehicleAlert)
// ---------------------------------------------------------------------------

export function escalationPolicy({ deviceId, alertId }) {
  return {
    type: 'tracking.alert.escalated',
    entityType: 'tracking',
    severity: 'critical',
    audience: { managers: true },
    channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.PUSH],
    // Manual escalations (no alertId) are intentionally NEVER deduped —
    // every click creates a fresh notification. Do not "fix" this.
    clientDedupKey: buildEscalationDedupKey(deviceId, alertId),
  };
}

// ---------------------------------------------------------------------------
// #3 Operation lifecycle (operationNotificationService.js)
// entityType/channels/source are already injected once, centrally, by
// deliverOperationNotification() — these entries intentionally return only
// {type, severity, clientDedupKey} so there is exactly one place that owns
// the shared fields, not two that could drift apart.
// ---------------------------------------------------------------------------

export function operationPlanReadyPolicy({ operationId }) {
  return {
    type: 'operation.plan.ready',
    severity: 'info',
    clientDedupKey: `operation:${operationId}:plan-ready`,
  };
}

export function operationApprovedPolicy({ operationId }) {
  return {
    type: 'operation.approved',
    severity: 'success',
    clientDedupKey: `operation:${operationId}:approved`,
  };
}

export function operationUnlockedPolicy({ operationId, expiresAt }) {
  // Unlock windows can be granted more than once — keyed on expiry so each
  // grant alerts. Falls back to Date.now() (always-fresh) if expiresAt is
  // absent. Do not collapse this across grants.
  // resolvedKey is returned so callers reuse the SAME value in their own
  // metadata rather than computing a second, possibly-divergent Date.now().
  const resolvedKey = expiresAt || Date.now();
  return {
    type: 'operation.unlocked',
    severity: 'info',
    clientDedupKey: `operation:${operationId}:unlocked:${resolvedKey}`,
    resolvedKey,
  };
}

export function operationLockApproachingPolicy({ operationId }) {
  return {
    type: 'operation.lock.approaching',
    severity: 'warning',
    clientDedupKey: `operation:${operationId}:lock-approaching`,
  };
}

export function operationRecordingIncompletePolicy({ operationId }) {
  return {
    type: 'operation.recording.incomplete',
    severity: 'warning',
    clientDedupKey: `operation:${operationId}:recording-incomplete`,
  };
}

// ---------------------------------------------------------------------------
// #4 Operation refuel recorded (operationRefuelListeners.js)
// ---------------------------------------------------------------------------

export function operationRefuelRecordedPolicy({ sessionId, refuelId, driverId }) {
  return {
    type: 'operation.refuel.recorded',
    entityType: 'fuel',
    severity: 'info',
    audience: { includeDriverWithManagers: true, driverId: Number(driverId) },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `operation:${sessionId}:refuel:${refuelId}:recorded`,
  };
}

// ---------------------------------------------------------------------------
// #4b Operation refuel arrived / skipped / invoice reconciled, vehicle
// document OCR completed (operationRefuelListeners.js) — Phase 2 additions.
// These previously only fired a raw socket emit with no persisted inbox
// row; this closes that gap. Not carried over from Phase 1 (that phase's
// inventory covered only the 11 producers already persisting).
// ---------------------------------------------------------------------------

export function operationRefuelArrivedPolicy({ sessionId, refuelId, driverId }) {
  return {
    type: 'operation.refuel.arrived',
    entityType: 'fuel',
    severity: 'info',
    audience: { includeDriverWithManagers: true, driverId: Number(driverId) },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `operation:${sessionId}:refuel:${refuelId}:arrived`,
  };
}

export function operationRefuelSkippedPolicy({ sessionId, refuelId, driverId }) {
  return {
    type: 'operation.refuel.skipped',
    entityType: 'fuel',
    severity: 'warning',
    audience: { includeDriverWithManagers: true, driverId: Number(driverId) },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `operation:${sessionId}:refuel:${refuelId}:skipped`,
  };
}

export function operationInvoiceReconciledPolicy({ sessionId, invoiceId, driverId }) {
  return {
    type: 'operation.invoice.reconciled',
    entityType: 'fuel',
    severity: 'success',
    audience: { includeDriverWithManagers: true, driverId: Number(driverId) },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `operation:${sessionId}:invoice:${invoiceId}:reconciled`,
  };
}

export function vehicleDocumentOcrCompletedPolicy({ fleetVehicleId, documentId }) {
  return {
    type: 'vehicle.document.ocr.completed',
    entityType: 'vehicle',
    severity: 'info',
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `vehicle:${fleetVehicleId}:document:${documentId}:ocr-completed`,
  };
}

// ---------------------------------------------------------------------------
// #5 Vehicle assignment (vehicleAssignedListeners.js)
// ---------------------------------------------------------------------------

export function vehicleAssignmentPolicy({ vehicleId, deviceId, assignedAt }) {
  // Computed once and returned so the call site's metadata.assignedAt uses
  // the SAME fallback value as the dedup key, rather than a second
  // independently-computed Date.now() that could diverge by milliseconds.
  const resolvedAssignedAt = assignedAt || new Date().toISOString();
  return {
    type: 'assignment.vehicle.updated',
    entityType: 'assignment',
    severity: 'info',
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `assignment:${vehicleId}:${deviceId}:${resolvedAssignedAt}`,
    resolvedAssignedAt,
  };
}

// ---------------------------------------------------------------------------
// #6 ERB pricing (erbPriceListeners.js)
// ---------------------------------------------------------------------------

export function erbPricesPolicy({ timestamp }) {
  const at = timestamp || new Date().toISOString();
  const key = `erb:${at}`;
  return {
    type: 'erb.prices.updated',
    entityType: 'system',
    severity: 'info',
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    // Reused as both entityId and dedup key at the call site, exactly as today.
    clientDedupKey: key,
    resolvedAt: at,
  };
}

// ---------------------------------------------------------------------------
// #7 Compliance findings (complianceNotificationService.js)
// companyId is NOT part of this schema — stays a call-site-local variable.
// ---------------------------------------------------------------------------

function complianceSeverity(status) {
  const s = String(status || '').toLowerCase();
  return (s === 'overdue' || s === 'expired' || s === 'due') ? 'warning' : 'info';
}

export function complianceFindingPolicy({ fleetVehicleId, type, status }) {
  const dayStamp = localDateString(new Date());
  return {
    type: `compliance.${String(type).toLowerCase()}.${String(status).toLowerCase()}`,
    entityType: 'compliance',
    severity: complianceSeverity(status),
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    // Intentional daily repeat while the finding stays in this status — not a bug.
    clientDedupKey: `compliance:${fleetVehicleId}:${type}:${status}:${dayStamp}`,
  };
}

// ---------------------------------------------------------------------------
// #8 Immobilization transitions (immobilizationNotificationService.js)
// severity/PUBLISH_STATUS reused verbatim from that file (see imports above) —
// that file's own test (immobilizationNotificationService.test.js, Phase 0)
// imports them directly, so they stay defined there, not duplicated here.
// ---------------------------------------------------------------------------

export function immobilizationTransitionPolicy({ intentId, status }) {
  return {
    type: `immobilization.${status}`,
    entityType: 'security',
    severity: severityForStatus(status),
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `immobilization:${intentId}:${status}`,
  };
}

// ---------------------------------------------------------------------------
// #9a/9b Maintenance (maintenanceNotificationService.js)
// companyId is NOT part of this schema — stays a call-site-local variable.
// ---------------------------------------------------------------------------

export function maintenanceCompletedPolicy({ recordId, completedAt }) {
  const at = completedAt || new Date().toISOString();
  return {
    type: 'maintenance.routine.completed',
    entityType: 'maintenance',
    severity: 'success',
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `routine-service:${recordId}:completed:${at}`,
    resolvedCompletedAt: at,
  };
}

export function maintenanceRoutineStatePolicy({ fleetVehicleId, mappedType }) {
  const dayStamp = localDateString(new Date());
  return {
    type: `maintenance.routine.${mappedType}`,
    entityType: 'maintenance',
    severity: mappedType === 'overdue' ? 'warning' : 'info',
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    // Same Lusaka day-boundary helper compliance uses — intentionally shared,
    // not duplicated. This is one half of a known duplicate-producer overlap
    // with complianceFindingPolicy's ROUTINE_SERVICE finding type — Phase 4
    // consolidates that; this entry represents current behavior as-is.
    clientDedupKey: `routine-service:${fleetVehicleId}:${mappedType}:${dayStamp}`,
  };
}
