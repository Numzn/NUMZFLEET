/**
 * Pure helpers around the acceptance rules (acceptedCounter.js): turning Traccar positions into readings,
 * extending the remembered state to the latest position at read time, and placing accepted increments on
 * local days. No I/O.
 */
import { acceptCounterReading } from '../odometer/acceptedCounter.js';
import { extractTelemetryEvidence, rawTelemetryToKm } from '../odometer/normaliseEvidence.js';
import { localDateString, localMidnightUtc, addLocalDays, DEFAULT_BUSINESS_TIMEZONE } from '../../utils/businessDay.js';

const MICRO = 1e6;

/**
 * Place one accepted increment on local days.
 *  - continuous (readings close together): split by the time spent on each side of local midnight, so driving
 *    across midnight is shared out fairly and nothing is created or lost;
 *  - span (readings far apart): the distance is in the vehicle's cumulative mileage but cannot be placed on any
 *    particular day, so it is reported as UNATTRIBUTED on the day the silence ended -- never as confirmed.
 * @param {{ fromMs:number, toMs:number, km:number, kind:'continuous'|'span' }} increment
 * @returns {{ localDate:string, confirmedKm:number, unattributedKm:number, fromMs:number, toMs:number }[]}
 */
export function splitIncrementByLocalDay(increment, timeZone = DEFAULT_BUSINESS_TIMEZONE) {
  const { fromMs, toMs, km, kind } = increment;
  if (kind === 'span') {
    return [{ localDate: localDateString(new Date(toMs), timeZone), confirmedKm: 0, unattributedKm: km, fromMs: toMs, toMs }];
  }

  const firstDate = localDateString(new Date(fromMs), timeZone);
  const lastDate = localDateString(new Date(toMs), timeZone);
  if (firstDate === lastDate || toMs <= fromMs) {
    return [{ localDate: lastDate, confirmedKm: km, unattributedKm: 0, fromMs, toMs }];
  }

  // integer micro-km so the pieces add back to the whole exactly
  const totalMicro = Math.round(km * MICRO);
  const span = toMs - fromMs;
  const parts = [];
  let assigned = 0;
  for (let date = firstDate; date <= lastDate; date = addLocalDays(date, 1)) {
    const dayStart = Math.max(fromMs, localMidnightUtc(date, timeZone).getTime());
    const dayEnd = Math.min(toMs, localMidnightUtc(addLocalDays(date, 1), timeZone).getTime());
    const overlap = Math.max(0, dayEnd - dayStart);
    if (overlap === 0 && date !== lastDate) continue;
    const micro = date === lastDate ? totalMicro - assigned : Math.round((totalMicro * overlap) / span);
    assigned += micro;
    parts.push({ localDate: date, confirmedKm: micro / MICRO, unattributedKm: 0, fromMs: dayStart, toMs: dayEnd });
  }
  return parts;
}

/** The persisted tracker_counter_state row as the pure state the acceptance rules operate on. */
export function stateFromRow(row) {
  return {
    acceptedKm: Number(row.acceptedKm),
    rawKm: Number(row.rawKm),
    fixMs: new Date(row.fixTime).getTime(),
    positionId: row.positionId != null ? Number(row.positionId) : null,
    pending: row.pending ?? null,
  };
}

/**
 * The accepted counter right now: the remembered state extended to the tracker's latest position with the
 * SAME rules the ingest uses, but without writing anything. A latest position the ingest has not reached yet
 * can therefore never push a jump into the odometer in the meantime.
 *
 * With no remembered state (a tracker the ingest has not met yet) the raw counter is returned and labelled
 * 'raw', so a screen can say the reading is not yet validated.
 * @param {object|null} row tracker_counter_state row
 * @param {{ rawKm:number, fixMs:number, positionId?:number }|null} latest
 * @returns {{ acceptedKm:number|null, source:'accepted'|'raw', quarantined:boolean, pendingKind:string|null, acceptedAtMs:number|null }}
 */
export function liveAcceptedCounter(row, latest) {
  if (!row) {
    return {
      acceptedKm: latest?.rawKm ?? null, source: 'raw', quarantined: false, pendingKind: null, acceptedAtMs: latest?.fixMs ?? null,
    };
  }
  const state = stateFromRow(row);
  // acceptedAtMs is when the ACCEPTED evidence was taken. A reading that is being held out does not advance
  // it, so a tracker spewing glitches is never mistaken for a live one.
  const held = (s) => ({
    acceptedKm: s.acceptedKm,
    source: 'accepted',
    quarantined: Boolean(s.pending),
    pendingKind: s.pending?.kind ?? null,
    acceptedAtMs: s.fixMs,
  });

  const usable = latest && Number.isFinite(latest.rawKm) && Number.isFinite(latest.fixMs);
  if (!usable) return held(state);
  if (latest.positionId != null && row.positionCursor != null && Number(latest.positionId) <= Number(row.positionCursor)) {
    return held(state); // already part of the remembered state
  }
  return held(acceptCounterReading(state, latest).state);
}

function parseAttributes(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * A Traccar position as a counter reading in km. When the tracker's counter is locked to an attribute
 * (`lockedAttribute`), only that attribute is read: a position that lacks it yields no reading rather than
 * a reading on a different scale.
 */
export function readingFromPosition(position, lockedAttribute = null) {
  const attrs = parseAttributes(position?.attributes);
  let rawKm = null;
  let attribute = null;

  if (lockedAttribute) {
    const value = attrs[lockedAttribute];
    const n = value == null || value === '' ? Number.NaN : Number(value);
    if (Number.isFinite(n)) {
      rawKm = rawTelemetryToKm(n, lockedAttribute);
      attribute = lockedAttribute;
    }
  } else {
    const extracted = extractTelemetryEvidence(attrs);
    rawKm = extracted.km;
    attribute = extracted.attribute;
  }

  const fixMs = new Date(position?.fixtime).getTime();
  return {
    rawKm: rawKm ?? null,
    fixMs: Number.isFinite(fixMs) ? fixMs : null,
    positionId: position?.id != null ? Number(position.id) : null,
    attribute,
  };
}

/** The tracker telemetry object (getVehicleTelemetry) as a counter reading, under a locked attribute if any. */
export function readingFromTelemetry(telemetry, lockedAttribute = null) {
  if (!telemetry) return null;
  return readingFromPosition({
    id: telemetry.positionId,
    fixtime: telemetry.positionFixTime,
    attributes: telemetry.positionAttributes,
  }, lockedAttribute);
}
