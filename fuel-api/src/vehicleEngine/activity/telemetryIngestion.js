import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { DeviceAssignment, VehicleActivityState } from '../../models/index.js';
import { normalizeTraccarEvent } from './telemetryNormalize.js';
import { evaluateAndHeal } from './evaluateAndHeal.js';
import { persistActivityState } from './activityStateService.js';
import { recordVehicleStateCorrection } from './vehicleStateAuditService.js';
import { withAdvisoryLock } from '../../utils/advisoryLock.js';

function logTelemetry(event, fields = {}) {
  console.log(JSON.stringify({ event, ...fields, ts: new Date().toISOString() }));
}

/** Prior outcome for this event, or null if never attempted. */
async function getEventOutcome(eventId) {
  const rows = await sequelize.query(
    'SELECT outcome FROM telemetry_processed_events WHERE event_id = :eventId',
    { replacements: { eventId }, type: QueryTypes.SELECT },
  );
  return rows[0]?.outcome ?? null;
}

/**
 * Records the final outcome of an attempt (upsert — a retry after a prior
 * failure overwrites the old row rather than being blocked by it). Only ever
 * called once the attempt has actually concluded, success or failure, so
 * "processed" in this table always means the state was actually persisted.
 */
async function recordOutcome(eventId, fields) {
  await sequelize.query(
    `INSERT INTO telemetry_processed_events (event_id, "deviceId", "eventType", "vehicleId", outcome)
     VALUES (:eventId, :deviceId, :eventType, :vehicleId, :outcome)
     ON CONFLICT (event_id) DO UPDATE SET
       "deviceId" = EXCLUDED."deviceId",
       "eventType" = EXCLUDED."eventType",
       "vehicleId" = EXCLUDED."vehicleId",
       outcome = EXCLUDED.outcome,
       "processedAt" = now()`,
    {
      replacements: {
        eventId,
        deviceId: fields.deviceId ?? null,
        eventType: fields.eventType ?? null,
        vehicleId: fields.vehicleId ?? null,
        outcome: fields.outcome,
      },
      type: QueryTypes.INSERT,
    },
  );
}

/**
 * Orchestrates one Traccar event end-to-end: normalize -> dedupe -> resolve
 * vehicle -> lock -> VehicleStateEngine -> persist -> log -> emit. No
 * classification/transition logic lives here — that's vehicleStateEngine.js.
 *
 * Never throws: failures are caught and logged so a bad event can't take down
 * the queue worker or crash the ingestion endpoint's response.
 */
export async function processTelemetryEvent(rawEvent) {
  const normalized = normalizeTraccarEvent(rawEvent);
  if (!normalized) {
    logTelemetry('telemetry.ingest.rejected', { reason: 'malformed_payload' });
    return;
  }

  const {
    eventId, deviceId, eventType, eventTime, deviceStatus, deviceLastUpdate, positionSpeed, positionFixTime,
  } = normalized;

  try {
    // Deterministic tie-break + visibility for a known, tracked data-integrity
    // gap: nothing in the schema today prevents two active assignments for the
    // same physical device (see docs/TENANCY_ARCHITECTURE.md §9 — a partial
    // unique index is planned Phase 3 work, not yet authorized). Without an
    // explicit order, findOne() would return whichever row Postgres happens to
    // pick, which could nondeterministically flip which vehicle "owns" this
    // device's events across calls. Most-recently-assigned wins, deterministically,
    // and a duplicate is logged rather than silently tolerated.
    const activeAssignments = await DeviceAssignment.findAll({
      where: { deviceId, isActive: true },
      order: [['assignedAt', 'DESC']],
    });
    if (activeAssignments.length > 1) {
      logTelemetry('telemetry.ingest.duplicate_active_assignment', {
        deviceId, count: activeAssignments.length, chosenVehicleId: activeAssignments[0].vehicleId,
      });
    }
    const assignment = activeAssignments[0] ?? null;
    const vehicleId = assignment?.vehicleId ?? null;

    if (!vehicleId) {
      await recordOutcome(eventId, { deviceId, eventType, vehicleId: null, outcome: 'skipped_unmapped_device' });
      return;
    }

    await withAdvisoryLock(vehicleId, async () => {
      // Only a prior *successful* attempt is a true duplicate. Anything else
      // (never attempted, or a prior attempt that errored) is retried here —
      // this is what lets the hourly reconciliation job actually recover a
      // transition that failed to persist the first time.
      const priorOutcome = await getEventOutcome(eventId);
      if (priorOutcome === 'processed') {
        logTelemetry('telemetry.ingest.duplicate', { eventId, deviceId, vehicleId });
        return;
      }

      let transition;
      try {
        const existing = await VehicleActivityState.findOne({ where: { vehicleId } });
        transition = await evaluateAndHeal({
          vehicleId,
          deviceId,
          deviceStatus,
          deviceLastUpdate,
          positionSpeed,
          positionFixTime,
          existing,
          now: eventTime.getTime(),
        }, { source: 'webhook' });

        await persistActivityState({
          vehicleId,
          deviceId,
          state: transition.state,
          stateEnteredAt: transition.stateEnteredAt,
          stateSource: transition.stateSource,
        }, new Date());

        if (transition.isCorrection) {
          await recordVehicleStateCorrection({
            vehicleId,
            previousState: transition.previousState,
            correctedState: transition.state,
            previousStateEnteredAt: transition.previousStateEnteredAt,
            correctedStateEnteredAt: transition.stateEnteredAt,
            reason: transition.reason,
            source: 'webhook',
            payload: { deviceId, eventType, issues: transition.issues },
          });
        }
      } catch (err) {
        await recordOutcome(eventId, { deviceId, eventType, vehicleId, outcome: 'error' });
        throw err;
      }

      await recordOutcome(eventId, { deviceId, eventType, vehicleId, outcome: 'processed' });

      if (transition.issues?.includes('stale_evidence_ignored')) {
        // Distinct from the routine line below on purpose — this is the one
        // log line that proves a delayed/out-of-order event was correctly
        // rejected instead of silently blending into "just another processed
        // event" or, worse, into a silent state regression.
        logTelemetry('telemetry.ingest.stale_evidence_ignored', {
          eventId, deviceId, vehicleId, eventType, persistedState: transition.state,
        });
      } else {
        logTelemetry('telemetry.ingest.processed', {
          eventId,
          deviceId,
          vehicleId,
          eventType,
          state: transition.state,
          stateSource: transition.stateSource,
          changed: transition.changed,
        });
      }
    });
  } catch (err) {
    logTelemetry('telemetry.ingest.error', {
      eventId,
      deviceId,
      eventType,
      message: err?.message || String(err),
    });
  }
}
