import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { DeviceAssignment, VehicleActivityState } from '../../models/index.js';
import { normalizeTraccarEvent } from './telemetryNormalize.js';
import { evaluateAndHeal } from './evaluateAndHeal.js';
import { persistActivityState } from './activityStateService.js';
import { recordVehicleStateCorrection } from './vehicleStateAuditService.js';
import { emitDomainEvent } from '../../events/eventBus.js';
import { EVENT_NAMES } from '../../events/eventNames.js';

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

async function withVehicleLock(vehicleId, fn) {
  const lockKey = { key: vehicleId };
  await sequelize.query('SELECT pg_advisory_lock(hashtext(:key)::bigint)', {
    replacements: lockKey,
    type: QueryTypes.SELECT,
  });
  try {
    return await fn();
  } finally {
    await sequelize.query('SELECT pg_advisory_unlock(hashtext(:key)::bigint)', {
      replacements: lockKey,
      type: QueryTypes.SELECT,
    });
  }
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

  const { eventId, deviceId, eventType, eventTime, deviceStatus, deviceLastUpdate, positionSpeed } = normalized;

  try {
    const assignment = await DeviceAssignment.findOne({ where: { deviceId, isActive: true } });
    const vehicleId = assignment?.vehicleId ?? null;

    if (!vehicleId) {
      await recordOutcome(eventId, { deviceId, eventType, vehicleId: null, outcome: 'skipped_unmapped_device' });
      return;
    }

    await withVehicleLock(vehicleId, async () => {
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

      logTelemetry('telemetry.ingest.processed', {
        eventId,
        deviceId,
        vehicleId,
        eventType,
        state: transition.state,
        stateSource: transition.stateSource,
        changed: transition.changed,
      });

      if (transition.changed) {
        emitDomainEvent(EVENT_NAMES.VEHICLE_STATE_CHANGED, {
          vehicleId,
          deviceId,
          state: transition.state,
          stateEnteredAt: transition.stateEnteredAt,
          stateSource: transition.stateSource,
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
