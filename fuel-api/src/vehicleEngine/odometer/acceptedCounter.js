/**
 * Which tracker counter readings may advance a vehicle's mileage (docs/VEHICLE_OWNED_ODOMETER.md,
 * "Accepted readings").
 *
 * A tracker reports a cumulative counter. Trusting every value as it arrives lets one glitch inflate the
 * odometer, or a reset freeze it. Instead the counter is walked reading by reading against a remembered
 * ACCEPTED state, and a reading only advances the accepted counter if the step it implies is plausible.
 * This module is pure -- no I/O, no clock -- and is the one rule set used by the background ingest, the
 * live odometer and the daily ledger, so cumulative and daily mileage are derived from the same evidence.
 *
 * Readings are processed in ARRIVAL order (Traccar's position id order), the order in which Traccar's own
 * cumulative totalDistance is computed. Fix time is used only to bound plausibility and to attribute
 * increments to time. The raw positions are never altered; this only decides what counts.
 *
 * Rules, in order, for a reading with counter `raw` against the state's raw watermark `w`
 * (dc = raw - w, dt = elapsed time between the two fixes):
 *   1. no usable counter                                         ignored   (never treated as zero)
 *   2. same position / same counter at an older time             duplicate
 *   3. |dc| <= 0.05 km                                           stationary wobble; a rise is added, a dip ignored
 *   4. 0 < dc <= plausible(dt)                                   ACCEPTED  (a 'span' if dt > 30 min: its day is unknown)
 *   5. dc too large but raw/1000 would be plausible              ACCEPTED corrected   (unit_corrected)
 *   6. dc < 0 and raw + modulus - w is plausible for a known     ACCEPTED as a counter rollover
 *      counter width (65,536 / 100,000 / ... km)
 *   7. anything else                                             QUARANTINED: the accepted counter does not
 *                                                                 move, and the reading is remembered as pending
 * While a reading is pending, each next reading either
 *   - is plausible against the OLD watermark  -> the pending one was a spike: discarded, never counted;
 *   - or continues consistently from the pending reading -> after 3 consistent readings the new level is
 *     ACCEPTED (a level shift if it jumped up, a counter reset if it dropped): the jump itself is NOT counted,
 *     the vehicle's mileage simply continues from the new level, and a reset is reported as unobserved;
 *   - or is consistent with neither -> the pending reading is replaced (a flapping counter never gets in).
 *
 * Invariant (tested over thousands of random steps): acceptedKm == start + the sum of the increments emitted.
 */

export const ACCEPTANCE = Object.freeze({
  MAX_SPEED_KMH: 180,
  /** Same per-day ceiling the observation rules and the daily read model use. */
  MAX_KM_PER_DAY: 1500,
  MIN_STEP_MS: 60 * 1000,
  STEP_SLACK_KM: 1,
  NOISE_KM: 0.05,
  /** Between readings further apart than this, an increment cannot be placed inside a particular day. */
  GAP_MS: 30 * 60 * 1000,
  CONFIRMATIONS: 3,
  ROLLOVER_MODULI_KM: Object.freeze([65_536, 100_000, 1_000_000, 1_048_576, 16_777_216]),
  UNIT_RATIO_MIN: 500,
  UNIT_RATIO_MAX: 2000,
});

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The most distance a vehicle could cover between two readings `dtMs` apart. */
export function plausibleStepKm(dtMs) {
  const dt = Math.max(Math.abs(Number.isFinite(dtMs) ? dtMs : 0), ACCEPTANCE.MIN_STEP_MS);
  const bySpeed = (ACCEPTANCE.MAX_SPEED_KMH * dt) / HOUR_MS;
  const byDay = ACCEPTANCE.MAX_KM_PER_DAY * Math.max(1, dt / DAY_MS);
  return Math.min(bySpeed, byDay) + ACCEPTANCE.STEP_SLACK_KM;
}

/** @param {{ rawKm: number, fixMs: number, positionId?: number }} reading */
export function startCounterState(reading) {
  return {
    acceptedKm: reading.rawKm,
    rawKm: reading.rawKm,
    fixMs: reading.fixMs,
    positionId: reading.positionId ?? null,
    pending: null,
  };
}

const usable = (reading) => typeof reading?.rawKm === 'number'
  && Number.isFinite(reading.rawKm)
  && reading.rawKm >= 0
  && Number.isFinite(reading.fixMs);

const done = (state, events = [], increments = []) => ({ state, events, increments });

function increment(state, reading, km) {
  const a = Math.min(state.fixMs, reading.fixMs);
  const b = Math.max(state.fixMs, reading.fixMs);
  return { fromMs: a, toMs: b, km, kind: b - a > ACCEPTANCE.GAP_MS ? 'span' : 'continuous' };
}

/** A plausible step from the watermark to this reading, possibly after correcting its scale or wrapping. */
function classifyStep(state, reading) {
  const dc = reading.rawKm - state.rawKm;
  const dtMs = reading.fixMs - state.fixMs;
  const bound = plausibleStepKm(dtMs);

  if (Math.abs(dc) <= ACCEPTANCE.NOISE_KM) return { kind: dc >= 0 ? 'tick' : 'dip', dc };
  if (dc > 0 && dc <= bound) return { kind: 'step', dc };

  if (dc > 0 && state.rawKm > 0) {
    const ratio = reading.rawKm / state.rawKm;
    if (ratio >= ACCEPTANCE.UNIT_RATIO_MIN && ratio <= ACCEPTANCE.UNIT_RATIO_MAX) {
      const corrected = reading.rawKm / 1000;
      const dc2 = corrected - state.rawKm;
      if (dc2 >= -ACCEPTANCE.NOISE_KM && dc2 <= bound) return { kind: 'unit', dc: Math.max(dc2, 0), correctedKm: corrected };
    }
  }

  if (dc < 0) {
    for (const modulus of ACCEPTANCE.ROLLOVER_MODULI_KM) {
      const inc = reading.rawKm + modulus - state.rawKm;
      if (inc >= 0 && inc <= bound && state.rawKm >= modulus - bound) return { kind: 'rollover', dc: inc, modulus };
    }
  }

  return { kind: 'implausible', dc };
}

function applyAccepted(state, reading, km, rawKm = reading.rawKm) {
  return {
    ...state,
    acceptedKm: state.acceptedKm + km,
    rawKm,
    fixMs: Math.max(state.fixMs, reading.fixMs),
    positionId: reading.positionId ?? state.positionId,
    pending: null,
  };
}

function toPending(reading) {
  return { rawKm: reading.rawKm, fixMs: reading.fixMs, positionId: reading.positionId ?? null };
}

/** Is `reading` a believable continuation of the pending (quarantined) level? */
function continuesPending(pending, reading) {
  const last = pending.readings[pending.readings.length - 1];
  const dc = reading.rawKm - last.rawKm;
  return dc >= -ACCEPTANCE.NOISE_KM && dc <= plausibleStepKm(reading.fixMs - last.fixMs);
}

/**
 * Feed one reading through the rules.
 * @param {{ acceptedKm:number, rawKm:number, fixMs:number, positionId:number|null, pending:object|null }} state
 * @param {{ rawKm:number, fixMs:number, positionId?:number }} reading counter already in km
 * @returns {{ state: object, events: object[], increments: { fromMs:number, toMs:number, km:number, kind:'continuous'|'span' }[] }}
 */
export function acceptCounterReading(state, reading) {
  if (!usable(reading)) return done(state, [{ type: 'ignored', reason: 'no_counter' }]);

  if ((reading.rawKm === state.rawKm && reading.fixMs <= state.fixMs)
    || (reading.positionId != null && reading.positionId === state.positionId)) {
    return done(state, [{ type: 'duplicate' }]);
  }

  if (state.pending) return acceptWhilePending(state, reading);
  return acceptAgainstWatermark(state, reading);
}

function acceptAgainstWatermark(state, reading) {
  const step = classifyStep(state, reading);

  switch (step.kind) {
    case 'dip':
      // a dip inside the noise band: the high-water mark stands
      return done({ ...state, fixMs: Math.max(state.fixMs, reading.fixMs), positionId: reading.positionId ?? state.positionId });
    case 'tick':
    case 'step': {
      const inc = increment(state, reading, step.dc);
      const events = inc.kind === 'span' ? [{ type: 'gap', fromMs: inc.fromMs, toMs: inc.toMs, km: step.dc }] : [];
      return done(applyAccepted(state, reading, step.dc), events, step.dc > 0 ? [inc] : []);
    }
    case 'unit': {
      const inc = increment(state, reading, step.dc);
      return done(
        applyAccepted(state, reading, step.dc, step.correctedKm),
        [{ type: 'unit_corrected', rawKm: reading.rawKm, correctedKm: step.correctedKm }],
        step.dc > 0 ? [inc] : [],
      );
    }
    case 'rollover': {
      const inc = increment(state, reading, step.dc);
      return done(applyAccepted(state, reading, step.dc), [{ type: 'rollover', modulusKm: step.modulus }], [inc]);
    }
    default: {
      const kind = step.dc < 0 ? 'reset' : 'jump';
      return done(
        { ...state, pending: { kind, jumpKm: step.dc, readings: [toPending(reading)] } },
        [{ type: 'quarantined', reason: kind, jumpKm: step.dc, positionId: reading.positionId ?? null, fixMs: reading.fixMs }],
      );
    }
  }
}

function acceptWhilePending(state, reading) {
  const { pending } = state;

  // 1. Back at the old level: the pending reading was a spike. Discard it, count nothing for it.
  const against = classifyStep({ ...state, pending: null }, reading);
  if (against.kind !== 'implausible') {
    const cleared = { ...state, pending: null };
    const next = acceptAgainstWatermark(cleared, reading);
    return done(next.state, [{ type: 'spike_discarded', readings: pending.readings.length }, ...next.events], next.increments);
  }

  // 2. Still away from the old level: does it continue the pending level?
  if (continuesPending(pending, reading)) {
    const readings = [...pending.readings, toPending(reading)];
    if (readings.length < ACCEPTANCE.CONFIRMATIONS) {
      return done({ ...state, pending: { ...pending, readings } });
    }
    return confirmPending(state, pending, readings);
  }

  // 3. Consistent with neither: a flapping counter. Start over from this reading.
  const kind = reading.rawKm < state.rawKm ? 'reset' : 'jump';
  const jumpKm = reading.rawKm - state.rawKm;
  return done(
    { ...state, pending: { kind, jumpKm, readings: [toPending(reading)] } },
    [{ type: 'quarantined', reason: kind, jumpKm, positionId: reading.positionId ?? null, fixMs: reading.fixMs }],
  );
}

/** Enough consistent readings at the new level: accept the level WITHOUT counting the jump itself. */
function confirmPending(state, pending, readings) {
  const [first, ...rest] = readings;
  const jumpKm = first.rawKm - state.rawKm;
  const kind = jumpKm < 0 ? 'reset' : 'jump';
  const events = [kind === 'reset'
    ? { type: 'reset_accepted', jumpKm, fromMs: state.fixMs, toMs: first.fixMs, unobserved: true }
    : { type: 'level_shift_accepted', jumpKm, fromMs: state.fixMs, toMs: first.fixMs, unobserved: true }];

  // Re-base on the first reading at the new level, then replay the rest as ordinary steps.
  let current = {
    ...state,
    rawKm: first.rawKm,
    fixMs: Math.max(state.fixMs, first.fixMs),
    positionId: first.positionId ?? state.positionId,
    pending: null,
  };
  const increments = [];
  for (const reading of rest) {
    const next = acceptCounterReading(current, reading);
    current = next.state;
    events.push(...next.events);
    increments.push(...next.increments);
  }
  return done(current, events, increments);
}

/** Feed many readings in order and collect everything. */
export function replay(state, readings) {
  let current = state;
  const events = [];
  const increments = [];
  for (const reading of readings) {
    const next = acceptCounterReading(current, reading);
    current = next.state;
    events.push(...next.events);
    increments.push(...next.increments);
  }
  return { state: current, events, increments };
}
