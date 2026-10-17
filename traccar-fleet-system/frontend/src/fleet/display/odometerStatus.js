/**
 * How much a displayed odometer can be trusted, in words — derived ONLY from what fuel-api already decided.
 *
 * The backend is authoritative for mileage (vehicle-owned anchor + accepted tracker readings). This module
 * never recomputes a distance and never upgrades a value: it names the provenance the backend reported
 * (`odometerVerification`, `odometerReconciliation`, `odometerReadingStatus`, `odometerBaselinePending`,
 * `odometerEvidenceAt`, `dailyMileage.unattributedKm`) so every surface says the same thing.
 */

const MIN_MS = 60000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

/** Evidence older than this is flagged, not merely aged (matches the backend's `stale_telemetry_day` grade). */
export const STALE_EVIDENCE_MS = DAY_MS;

/** Age is spelled out in the card details once it is worth noticing. */
const AGE_WORTH_STATING_MS = 15 * MIN_MS;

/**
 * "3 days ago" style age of the last accepted tracker reading. Null when there is no usable timestamp.
 * @param {string|number|Date|null|undefined} iso
 * @param {number} [now]
 */
export function formatReadingAge(iso, now = Date.now()) {
  if (iso == null || iso === '') return null;
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return null;
  const ageMs = Math.max(0, now - at);
  if (ageMs < MIN_MS) return 'just now';
  if (ageMs < HOUR_MS) return `${Math.floor(ageMs / MIN_MS)} min ago`;
  if (ageMs < DAY_MS) return `${Math.floor(ageMs / HOUR_MS)} h ago`;
  const days = Math.floor(ageMs / DAY_MS);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

const finite = (v) => v != null && v !== '' && Number.isFinite(Number(v));

/**
 * @param {object|null|undefined} display - a vehicle display model (resolveVehicleDisplay) or a fleet row
 * @param {number} [now]
 * @returns {{
 *   label: string,
 *   state: 'none'|'review'|'awaiting'|'provisional'|'calibrating'|'verified'|'unverified'|'estimated',
 *   tone: 'ok'|'warn'|'muted',
 *   attention: boolean,
 *   stale: boolean,
 *   lowConfidence: boolean,
 *   age: string|null,
 *   details: string[],
 * }}
 */
export function describeOdometerStatus(display, now = Date.now()) {
  if (!display || !finite(display.odometerKm)) {
    return {
      label: 'No odometer', state: 'none', tone: 'muted', attention: false, stale: false, lowConfidence: false, age: null, details: [],
    };
  }

  const verification = display.odometerVerification ?? 'none';
  const reconciliation = display.odometerReconciliation ?? 'none';
  const quarantined = display.odometerReadingStatus === 'quarantined';
  const pendingBaseline = Boolean(display.odometerBaselinePending);
  const lowConfidence = display.odometerConfidence === 'low';

  const evidenceAt = display.odometerEvidenceAt ?? null;
  const evidenceMs = evidenceAt ? new Date(evidenceAt).getTime() : NaN;
  const age = Number.isFinite(evidenceMs) ? formatReadingAge(evidenceAt, now) : null;
  const ageMs = Number.isFinite(evidenceMs) ? Math.max(0, now - evidenceMs) : null;
  const stale = ageMs != null && ageMs >= STALE_EVIDENCE_MS;

  const details = [];
  let label;
  let state;
  let tone;

  if (quarantined) {
    label = 'Reading under review';
    state = 'review';
    tone = 'warn';
    details.push('A suspicious tracker reading is being held for review and is not counted.');
  } else if (reconciliation === 'awaiting_tracker') {
    label = 'Awaiting tracker';
    state = 'awaiting';
    tone = 'warn';
    details.push('Waiting for the new tracker’s first valid reading; showing the last accepted odometer.');
  } else if (reconciliation === 'provisional') {
    label = 'Provisional';
    state = 'provisional';
    tone = 'warn';
    details.push('New tracker readings are provisional until they are reconciled with the last accepted odometer.');
  } else if (pendingBaseline && verification !== 'physical') {
    label = 'Calibrating';
    state = 'calibrating';
    tone = 'warn';
    details.push('The odometer baseline has not yet been matched to the tracker counter.');
  } else if (verification === 'physical') {
    label = 'Verified';
    state = 'verified';
    tone = 'ok';
  } else if (verification === 'unverified_legacy') {
    label = 'Unverified';
    state = 'unverified';
    tone = 'muted';
    details.push('Carried over from before readings were confirmed against the dashboard.');
  } else {
    label = 'Estimated';
    state = 'estimated';
    tone = 'muted';
  }

  if (pendingBaseline && verification === 'physical' && !quarantined) {
    details.push('The tracker counter has not yet been matched to this confirmed reading.');
  }

  let attention = tone === 'warn';

  if (stale) {
    tone = 'warn';
    attention = true;
  }
  if (age && (stale || (ageMs != null && ageMs >= AGE_WORTH_STATING_MS))) {
    details.push(`Last reading ${age}.`);
  }

  if (lowConfidence) {
    tone = 'warn';
    attention = true;
    details.push('Low confidence in this value.');
  }

  const unattributed = Number(display.dailyMileage?.unattributedKm);
  if (Number.isFinite(unattributed) && unattributed > 0) {
    details.push(`${unattributed.toFixed(1)} km unobserved today (tracker silent); not included in the daily total.`);
  }
  if (Number(display.dailyMileage?.revisionCount) > 0) {
    details.push('Today’s distance was revised after late tracker data arrived.');
  }

  return {
    label, state, tone, attention, stale, lowConfidence, age, details,
  };
}

/**
 * The vehicle workspace header's "Odometer" stat: cumulative odometer only (never daily distance), with the
 * provenance and age of the reading under it.
 * @param {object|null|undefined} registry - the engine's `registry` (odometer + provenance fields)
 * @param {number|null|undefined} fallbackKm - the engine's own rounded figure if the registry is missing
 * @param {number} [now]
 * @returns {{ value: string, subtitle: string|null, warn: boolean }}
 */
export function odometerStat(registry, fallbackKm, now = Date.now()) {
  const km = finite(registry?.odometerKm) ? Number(registry.odometerKm) : (finite(fallbackKm) ? Number(fallbackKm) : null);
  if (km == null) return { value: '\u2014', subtitle: null, warn: false };
  const value = `${Math.round(km).toLocaleString()} km`;
  if (!finite(registry?.odometerKm)) return { value, subtitle: null, warn: false };
  const status = describeOdometerStatus(registry, now);
  return {
    value,
    subtitle: [status.label, status.age].filter(Boolean).join(' \u00b7 '),
    warn: status.attention,
  };
}

export default describeOdometerStatus;
