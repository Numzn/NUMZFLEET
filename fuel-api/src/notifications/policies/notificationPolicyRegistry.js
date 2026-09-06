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
 * in ./notificationPolicyService.js keeps its own signature, because it decides
 * from raw external event data and folding it into this registry's shape would
 * be a lossy translation for no benefit. It does, however, now speak the same
 * CHANNELS/SEVERITY/URGENCY vocabulary as this file — the 'bell'/'push'/'sms'
 * strings it used to return were a second representation of the same concepts.
 *
 * Every policy states `urgency` explicitly. It is not derived from severity
 * here (canonicalNotification.resolveUrgency only supplies a default for
 * callers that omit it) because "how serious" and "how fast" are genuinely
 * different questions and each policy is the right place to answer both.
 */

import { CHANNELS, IN_APP_CHANNELS, URGENCY } from '../contracts/notificationContract.js';
import { localDateString } from '../../utils/businessDay.js';
import { buildFuelDedupKey, buildEscalationDedupKey } from '../../modules/notifications/notificationService.js';
import { severityForStatus, PUBLISH_STATUS } from '../immobilizationNotificationService.js';

// Reused verbatim so this registry has exactly one place that knows the
// "always fresh, never dedup" pattern's shape, for the two producers that
// deliberately use it (manual escalation, operation-unlock).
export { buildFuelDedupKey, buildEscalationDedupKey, severityForStatus, PUBLISH_STATUS };

const STANDARD_CHANNELS = IN_APP_CHANNELS;

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
  const severity = fuelRequestSeverity(changeType, request);
  return {
    type: `fuel.request.${changeType}`,
    entityType: 'fuel',
    severity,
    // An emergency fuel request (the only path to 'critical' here) is someone
    // waiting on a decision; every other lifecycle change is a status update.
    urgency: severity === 'critical' ? URGENCY.IMMEDIATE : URGENCY.NORMAL,
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
    // A human deliberately pressed escalate — by definition it cannot wait.
    urgency: URGENCY.IMMEDIATE,
    audience: { managers: true },
    // PUSH was already in this list — previously inert (pushChannel.js was
    // a stub until 2026-09-01), now real, gated per-user same as email.
    channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.PUSH, CHANNELS.SMS],
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
    urgency: URGENCY.NORMAL,
    clientDedupKey: `operation:${operationId}:plan-ready`,
  };
}

export function operationApprovedPolicy({ operationId }) {
  return {
    type: 'operation.approved',
    severity: 'success',
    urgency: URGENCY.NORMAL,
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
    // A grant opens a bounded write window — useful promptly, but it is not
    // an incident and must not be allowed to wake anyone in a later phase.
    urgency: URGENCY.NORMAL,
    clientDedupKey: `operation:${operationId}:unlocked:${resolvedKey}`,
    resolvedKey,
  };
}

export function operationLockApproachingPolicy({ operationId }) {
  return {
    type: 'operation.lock.approaching',
    severity: 'warning',
    urgency: URGENCY.NORMAL,
    clientDedupKey: `operation:${operationId}:lock-approaching`,
  };
}

export function operationRecordingIncompletePolicy({ operationId }) {
  return {
    type: 'operation.recording.incomplete',
    severity: 'warning',
    urgency: URGENCY.NORMAL,
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
    // Highest-volume producer in the system and purely a log entry — the
    // clearest legitimate case for deferred, so a busy fuel day cannot turn
    // into a stream of interruptions once the delivery planner reads this.
    urgency: URGENCY.DEFERRED,
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
    urgency: URGENCY.DEFERRED,
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
    urgency: URGENCY.NORMAL,
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
    urgency: URGENCY.NORMAL,
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
    // A background job finishing — nobody is waiting on the notification.
    urgency: URGENCY.DEFERRED,
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
    urgency: URGENCY.NORMAL,
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
    // Infrequent and time-sensitive (pricing decisions depend on it), but not
    // an incident — normal, despite already carrying every channel.
    urgency: URGENCY.NORMAL,
    audience: { managers: true },
    // Email, SMS, and push added 2026-09-02 — fuel price changes are
    // infrequent and time-sensitive enough to warrant every channel.
    // Still gated per-user by effectiveChannelsResolver.js/the Settings
    // "System" row for email and push; SMS dispatches unconditionally
    // like every other SMS-carrying policy (see notificationDispatcher.js).
    channels: [...STANDARD_CHANNELS, CHANNELS.EMAIL, CHANNELS.SMS, CHANNELS.PUSH],
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

// A finding overdue this many days (or more) gets its own, more severe tier
// rather than reading identically to one that just crossed into overdue.
// 30 is not a tuned model — it mirrors evaluateDueDateStatus's own
// reminderLeadDays default (30 days advance notice on the way in, 30 days
// overdue for "critical" on the way out).
const COMPLIANCE_CRITICALLY_OVERDUE_DAYS = 30;

// Returns 'overdue'/'due'/'upcoming'/etc unchanged UNLESS status is overdue
// AND daysRemaining is a known, sufficiently negative number — daysRemaining
// is null for the Traccar-routine-service finding type and for any caller
// that doesn't pass it, so those are structurally exempt, not silently
// downgraded.
function complianceEscalationTier(status, daysRemaining) {
  const s = String(status || '').toLowerCase();
  if (s === 'overdue' && Number.isFinite(daysRemaining) && daysRemaining <= -COMPLIANCE_CRITICALLY_OVERDUE_DAYS) {
    return 'critically_overdue';
  }
  return s;
}

/**
 * @param {{ fleetVehicleId: string, type: string, status: string, daysRemaining?: number|null }} args
 *   `daysRemaining` is optional — omit it (or pass null) to preserve the
 *   exact previous type/dedup-key/severity shape for a status.
 */
export function complianceFindingPolicy({ fleetVehicleId, type, status, daysRemaining = null }) {
  const dayStamp = localDateString(new Date());
  const tier = complianceEscalationTier(status, daysRemaining);
  return {
    type: `compliance.${String(type).toLowerCase()}.${tier}`,
    entityType: 'compliance',
    severity: tier === 'critically_overdue' ? 'critical' : complianceSeverity(status),
    // Compliance findings are date-driven — an expiry known today is equally
    // actionable tomorrow morning. Never immediate, even at the critically
    // overdue tier, which is why this never becomes a mandatory/escalation
    // candidate.
    urgency: URGENCY.NORMAL,
    audience: { managers: true },
    // Email added 2026-08-31 — one of the initial, intentionally small set
    // of email-eligible policies (see maintenanceRoutineStatePolicy for the
    // other). Compliance findings are infrequent and benefit from a
    // persistent record; still gated per-user by effectiveChannelsResolver.js,
    // so this alone does not turn email on for anyone.
    channels: [...STANDARD_CHANNELS, CHANNELS.EMAIL],
    // Intentional daily repeat while the finding stays in this status — not a
    // bug. Keying on `tier` rather than the raw `status` means crossing into
    // critically-overdue gets a fresh notification the same day, instead of
    // silently waiting for tomorrow's bucket because the raw status ('overdue')
    // never changed.
    clientDedupKey: `compliance:${fleetVehicleId}:${type}:${tier}:${dayStamp}`,
    tier,
  };
}

// ---------------------------------------------------------------------------
// #8 Immobilization transitions (immobilizationNotificationService.js)
// severity/PUBLISH_STATUS reused verbatim from that file (see imports above) —
// that file's own test (immobilizationNotificationService.test.js, Phase 0)
// imports them directly, so they stay defined there, not duplicated here.
// ---------------------------------------------------------------------------

// SMS only for statuses that reflect an outcome of a command that actually
// reached the vehicle: 'completed' (Traccar HTTP accepted it) and 'failed'
// (a genuine delivery failure, e.g. traccar_http_rejected/device_reassigned).
// 'cancelled'/'expired' happen BEFORE any command is sent (only reachable
// from 'pending'/'monitoring' per ALLOWED_TRANSITIONS) — not failures, just
// never-executed. 'blocked' is never actually passed as a status by any
// current call site (dead defensively-handled value) — excluded too.
const IMMOBILIZATION_SMS_STATUSES = new Set(['completed', 'failed']);

// Push added 2026-09-01 alongside the existing SMS gate, same statuses,
// same reasoning — a real command outcome, not a never-executed state.
// Kept deliberately paired with SMS rather than added to every policy (see
// effectiveChannelsResolver.js and the "initial policies" note in
// pushChannel.js's own history) — this and escalationPolicy (which already
// listed PUSH, previously inert) are the only two channels arrays that
// carry it.
function immobilizationChannels(status) {
  return IMMOBILIZATION_SMS_STATUSES.has(status)
    ? [...STANDARD_CHANNELS, CHANNELS.SMS, CHANNELS.PUSH]
    : STANDARD_CHANNELS;
}

export function immobilizationTransitionPolicy({ intentId, status }) {
  return {
    type: `immobilization.${status}`,
    entityType: 'security',
    severity: severityForStatus(status),
    // A failed command means a vehicle is not in the state an operator
    // believes it is in — the one immobilization outcome that cannot wait.
    // 'completed' is the reassuring case; cancelled/expired/blocked never
    // reached the vehicle at all (see IMMOBILIZATION_SMS_STATUSES above).
    urgency: status === 'failed' ? URGENCY.IMMEDIATE : URGENCY.NORMAL,
    // Same reasoning as urgency: a failed immobilize/mobilize command must
    // reach a manager regardless of preferences or quiet hours — it is not
    // a status update, it is "the vehicle is not where you think it is."
    mandatory: status === 'failed',
    audience: { managers: true },
    channels: immobilizationChannels(status),
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
    // A record of work already done.
    urgency: URGENCY.DEFERRED,
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `routine-service:${recordId}:completed:${at}`,
    resolvedCompletedAt: at,
  };
}

// mappedType now carries the full upcoming/due_soon/prepare/due_now/overdue/
// critically_overdue ladder (see maintenanceNotificationService.js's
// mapRoutineStatusToType) instead of collapsing due_soon/prepare/due_now
// into one 'due' bucket — 'due' itself is kept mapped to 'info' for exact
// backward compatibility, though no live caller produces it anymore.
function maintenanceRoutineSeverity(mappedType) {
  if (mappedType === 'critically_overdue') return 'critical';
  if (mappedType === 'overdue' || mappedType === 'due_now' || mappedType === 'prepare') return 'warning';
  return 'info'; // upcoming, due_soon, due (legacy)
}

export function maintenanceRoutineStatePolicy({ fleetVehicleId, mappedType }) {
  const dayStamp = localDateString(new Date());
  return {
    type: `maintenance.routine.${mappedType}`,
    entityType: 'maintenance',
    severity: maintenanceRoutineSeverity(mappedType),
    // Service intervals are measured in days/kilometres, not minutes — true
    // even at the critically-overdue tier, which is why this stays NORMAL
    // rather than becoming a mandatory/escalation candidate.
    urgency: URGENCY.NORMAL,
    audience: { managers: true },
    // Email added 2026-08-31 — see complianceFindingPolicy's identical note.
    channels: [...STANDARD_CHANNELS, CHANNELS.EMAIL],
    // Same Lusaka day-boundary helper compliance uses — intentionally shared,
    // not duplicated. This is one half of a known duplicate-producer overlap
    // with complianceFindingPolicy's ROUTINE_SERVICE finding type — Phase 4
    // consolidates that; this entry represents current behavior as-is.
    clientDedupKey: `routine-service:${fleetVehicleId}:${mappedType}:${dayStamp}`,
  };
}

// ---------------------------------------------------------------------------
// #10 Vehicle fleet-state alerts (vehicleStateNotificationService.js)
// Threshold/transition-driven, computed from vehicle_activity_state — never
// from raw Traccar online/offline events (those stay deliberately skipped,
// see notificationPolicyService.js's SKIP_TYPES). companyId stays call-site-local.
// ---------------------------------------------------------------------------

export function vehicleGpsLostPolicy({ fleetVehicleId, stateEnteredAt }) {
  return {
    type: 'vehicle.gps.lost',
    entityType: 'tracking',
    severity: 'warning',
    // A connectivity gap, not a security incident — worth knowing promptly,
    // never worth waking someone or bypassing preferences for.
    urgency: URGENCY.NORMAL,
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    // One-shot per transition instant, not a daily repeat: this fires once
    // when the vehicle actually goes offline, not again on every sweep while
    // it stays offline — see vehicleExtendedOfflinePolicy for the "still
    // offline after a while" case, which IS a deliberate daily repeat.
    clientDedupKey: `vehicle:${fleetVehicleId}:gps-lost:${stateEnteredAt}`,
  };
}

export function vehicleGpsRecoveredPolicy({ fleetVehicleId, stateEnteredAt }) {
  return {
    type: 'vehicle.gps.recovered',
    entityType: 'tracking',
    severity: 'info',
    urgency: URGENCY.NORMAL,
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `vehicle:${fleetVehicleId}:gps-recovered:${stateEnteredAt}`,
  };
}

export function vehicleExtendedOfflinePolicy({ fleetVehicleId }) {
  const dayStamp = localDateString(new Date());
  return {
    type: 'vehicle.offline.extended',
    entityType: 'tracking',
    severity: 'warning',
    urgency: URGENCY.NORMAL,
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    // Same daily-repeat-while-ongoing convention as maintenance/compliance —
    // one reminder per vehicle per day for as long as it stays offline past
    // the threshold, not a fresh notification every 15-minute sweep tick.
    clientDedupKey: `vehicle:${fleetVehicleId}:offline-extended:${dayStamp}`,
  };
}

export function vehicleExcessiveIdlePolicy({ fleetVehicleId }) {
  const dayStamp = localDateString(new Date());
  return {
    type: 'vehicle.idle.excessive',
    entityType: 'tracking',
    severity: 'warning',
    urgency: URGENCY.NORMAL,
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `vehicle:${fleetVehicleId}:idle-excessive:${dayStamp}`,
  };
}

// ---------------------------------------------------------------------------
// #11 Vehicle intelligence findings (vehicleIntelligenceNotificationService.js)
// Wires 3 already-computed intelligenceBuilder.js findings that never reached
// publishNotification(): fuel.efficiency_declining, HEALTH_ATTENTION/
// HEALTH_CRITICAL. Non-routine MAINTENANCE_OVERDUE/DUE_SOON is deliberately
// NOT here — that one is cheap to batch (loadCompanyMaintenanceDueState
// already has the per-vehicle counts), so it's wired into
// maintenanceNotificationScheduler.js instead, scheduler-driven like the rest
// of that file, rather than page-view-triggered like this pair.
// ---------------------------------------------------------------------------

const INTELLIGENCE_FINDING_SEVERITY = {
  'fuel.efficiency_declining': 'warning',
  HEALTH_ATTENTION: 'warning',
  HEALTH_CRITICAL: 'critical',
};

export function vehicleIntelligenceFindingPolicy({ fleetVehicleId, code }) {
  const dayStamp = localDateString(new Date());
  return {
    type: `vehicle.intelligence.${code}`,
    entityType: 'vehicle',
    severity: INTELLIGENCE_FINDING_SEVERITY[code] || 'info',
    // Trend/health-score deterioration develops over days, not minutes — real
    // and worth a manager's attention, but never an "acknowledge now" event.
    urgency: URGENCY.NORMAL,
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    // Same daily-repeat-while-ongoing convention as maintenance/compliance —
    // one notification per vehicle per finding per day for as long as the
    // page is viewed AND the condition still holds, not a fresh one per view.
    clientDedupKey: `vehicle-intelligence:${fleetVehicleId}:${code}:${dayStamp}`,
  };
}

// ---------------------------------------------------------------------------
// #12 Non-routine maintenance risk (maintenanceNotificationScheduler.js)
// Distinct from maintenanceRoutineStatePolicy — this is the intelligence
// engine's MAINTENANCE_OVERDUE/DUE_SOON signal: OTHER (non-routine-tagged)
// Traccar maintenance schedules on the vehicle, aggregated as a count.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// #13 Fuel anomaly — tank capacity exceeded (operationRefuelListeners.js)
// Keyed on the specific refuel record: a fact about one historical fill, not
// an ongoing status, so (unlike maintenance/compliance) this is never
// day-stamped — one notification per anomalous refuel, ever.
// ---------------------------------------------------------------------------

export function fuelAnomalyPolicy({ sessionId, refuelId }) {
  return {
    type: 'fuel.anomaly.exceeds_capacity',
    entityType: 'fuel',
    severity: 'warning',
    urgency: URGENCY.NORMAL,
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `operation:${sessionId}:refuel:${refuelId}:anomaly-exceeds-capacity`,
  };
}

export function maintenanceRiskPolicy({ fleetVehicleId, tier }) {
  const dayStamp = localDateString(new Date());
  return {
    type: `maintenance.risk.${tier}`,
    entityType: 'maintenance',
    severity: tier === 'overdue' ? 'error' : 'warning',
    urgency: URGENCY.NORMAL,
    audience: { managers: true },
    channels: STANDARD_CHANNELS,
    clientDedupKey: `maintenance-risk:${fleetVehicleId}:${tier}:${dayStamp}`,
  };
}
