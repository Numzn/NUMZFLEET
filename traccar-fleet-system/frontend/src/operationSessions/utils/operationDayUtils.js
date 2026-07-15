export function groupOperationsByCalendarDate(sessions = []) {
  const groups = {};
  for (const session of sessions) {
    const key = session.calendarDate
      || (session.sessionDate ? String(session.sessionDate).slice(0, 10) : 'unknown');
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(session);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([calendarDate, items]) => ({
      calendarDate,
      operation: items[0],
    }));
}

export function getLocalTodayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Today's calendar key (YYYY-MM-DD) in the given IANA timezone, matching how the
 * backend derives `calendarDate`. Falls back to the browser-local key when no
 * timezone is provided or Intl is unavailable.
 */
export function getTodayKeyInTimeZone(timeZone, date = new Date()) {
  if (!timeZone) return getLocalTodayKey(date);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return getLocalTodayKey(date);
  }
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' });

/** "Today" / "Yesterday" / weekday name / "Last week" — falls back to the raw calendarDate beyond 2 weeks. */
export function relativeDayLabel(calendarDate, todayKey) {
  if (!calendarDate) return '';
  const [y, m, d] = String(calendarDate).split('-').map(Number);
  const [ty, tm, td] = String(todayKey || '').split('-').map(Number);
  if (!y || !m || !d || !ty || !tm || !td) return calendarDate;
  const rowUtc = Date.UTC(y, m - 1, d);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const diffDays = Math.round((todayUtc - rowUtc) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return WEEKDAY_FORMATTER.format(new Date(rowUtc));
  if (diffDays >= 7 && diffDays < 14) return 'Last week';
  return calendarDate;
}

/** First fleet timezone snapshotted on the operation rows, if any. */
export function resolveFleetTimezone(sessions = []) {
  for (const s of sessions) {
    if (s?.fleetTimezone) return s.fleetTimezone;
  }
  return null;
}

/**
 * The operation whose `calendarDate` matches today in the fleet timezone.
 * @param {Array} sessions operation rows (each carries `calendarDate` + `fleetTimezone`)
 * @param {string} [fleetTimezone] explicit timezone; otherwise derived from rows
 */
export function findTodayOperation(sessions = [], fleetTimezone) {
  const tz = fleetTimezone || resolveFleetTimezone(sessions);
  const todayKey = getTodayKeyInTimeZone(tz);
  return sessions.find((s) => String(s.calendarDate || '').slice(0, 10) === todayKey) || null;
}

/**
 * All operations whose `calendarDate` matches today in the fleet timezone.
 * Managers see one row per operator/day; operators usually see a single row.
 */
export function findTodayOperations(sessions = [], fleetTimezone) {
  const tz = fleetTimezone || resolveFleetTimezone(sessions);
  const todayKey = getTodayKeyInTimeZone(tz);
  return sessions.filter((s) => String(s.calendarDate || '').slice(0, 10) === todayKey);
}

/**
 * Short "locks in 3h 12m" / "locked" label from an ISO `locksAt` timestamp.
 * Returns null when no lock time is known.
 */
export function formatLockCountdown(locksAt, now = Date.now()) {
  if (!locksAt) return null;
  const lockMs = new Date(locksAt).getTime();
  if (!Number.isFinite(lockMs)) return null;
  const diff = lockMs - now;
  if (diff <= 0) return 'Locked';
  const totalMinutes = Math.floor(diff / 60000);
  if (totalMinutes < 1) return 'Locks in <1m';
  if (totalMinutes < 60) return `Locks in ${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `Locks in ${hours}h ${minutes}m` : `Locks in ${hours}h`;
}

export function statusChipColor(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') return 'primary';
  if (s === 'draft') return 'warning';
  if (s === 'locked') return 'default';
  return 'default';
}

export function formatStatusLabel(status) {
  return String(status || 'unknown').toUpperCase();
}

export function isRefuelComplete(refuel) {
  return refuel?.actualFuelLitres != null && Number(refuel.actualFuelLitres) > 0;
}

export function isRefuelSkipped(refuel) {
  return refuel?.skippedAt != null;
}

/**
 * Vehicle workflow state in operations language. Prefers the backend-computed
 * `workflowStatus`, falling back to deriving it from the refuel fields.
 */
export function deriveVehicleWorkflowState(refuel) {
  const fromApi = String(refuel?.workflowStatus || '').toLowerCase();
  if (['planned', 'arrived', 'fueled', 'skipped'].includes(fromApi)) {
    return fromApi;
  }
  if (isRefuelSkipped(refuel)) return 'skipped';
  if (isRefuelComplete(refuel)) return 'fueled';
  if (refuel?.arrivedAt != null) return 'arrived';
  return 'planned';
}

export const VEHICLE_STATE_LABEL = {
  planned: 'Planned',
  arrived: 'Arrived',
  fueled: 'Fueled',
  skipped: 'Skipped',
  exception: 'Exception',
};

export function vehicleStateChipColor(state) {
  switch (String(state || '').toLowerCase()) {
    case 'fueled': return 'success';
    case 'arrived': return 'info';
    case 'skipped': return 'default';
    case 'exception': return 'error';
    case 'planned':
    default: return 'warning';
  }
}

/** A refuel telemetry status that warrants supervisor attention. */
export function isRefuelException(refuel) {
  return ['warning', 'flagged', 'incomplete'].includes(String(refuel?.status || '').toLowerCase());
}

/**
 * Fueling Day vehicle buckets:
 *  - selected: vehicles planned for the day
 *  - arrived: at the pump but not yet fueled (or fueled, which implies arrival)
 *  - fueled: fuel recorded
 *  - skipped: explicitly skipped for the day
 *  - missing: planned but neither fueled nor skipped (still needs attention)
 *  - invoicedCount / pendingFueled / pendingRemaining: only meaningful once
 *    `invoices` is passed — see coveredRefuelIdSet(). A vehicle's active-queue
 *    journey (planned -> fueled -> invoiced) only ends once invoiced or skipped,
 *    so pendingRemaining is the true shrinking work queue, not just "not yet fueled."
 */
export function summarizeRefuelBuckets(refuels = [], invoices = []) {
  const selected = refuels.length;
  const fueled = refuels.filter(isRefuelComplete).length;
  const skipped = refuels.filter(isRefuelSkipped).length;
  const arrived = refuels.filter(
    (r) => !isRefuelSkipped(r) && (r?.arrivedAt != null || isRefuelComplete(r)),
  ).length;
  const missing = Math.max(0, selected - fueled - skipped);

  const covered = coveredRefuelIdSet(invoices);
  const invoicedCount = refuels.filter((r) => isRefuelComplete(r) && covered.has(Number(r.id))).length;
  const pendingFueled = fueled - invoicedCount;
  const pendingRemaining = Math.max(0, selected - skipped - invoicedCount);

  return {
    selected, arrived, fueled, skipped, missing, invoicedCount, pendingFueled, pendingRemaining,
  };
}

/** Set of refuel ids covered by any invoice. */
export function coveredRefuelIdSet(invoices = []) {
  return new Set(invoices.flatMap((i) => i.coveredRefuelIds || []).map(Number));
}

/** Any refuel-shaped rows (fueled or not) still in the active queue — i.e. not yet invoiced. */
export function filterUninvoiced(rows = [], invoices = [], idKey = 'id') {
  const covered = coveredRefuelIdSet(invoices);
  return rows.filter((r) => !covered.has(Number(r[idKey])));
}

/**
 * Splits fueled refuels into pending (not yet invoiced) vs invoiced.
 * Only fueled rows are considered — skipped/planned/arrived rows can't be invoiced.
 */
export function partitionFueledByCoverage(refuels = [], invoices = []) {
  const covered = coveredRefuelIdSet(invoices);
  const fueled = refuels.filter(isRefuelComplete);
  return {
    pending: fueled.filter((r) => !covered.has(Number(r.id))),
    invoiced: fueled.filter((r) => covered.has(Number(r.id))),
  };
}

/** Sum of actualFuelLitres/actualCost over a refuel subset. */
export function sumActualFuelAndCost(refuels = []) {
  return refuels.reduce((acc, r) => {
    const l = Number(r.actualFuelLitres);
    const c = Number(r.actualCost);
    return { litres: acc.litres + (Number.isFinite(l) ? l : 0), cost: acc.cost + (Number.isFinite(c) ? c : 0) };
  }, { litres: 0, cost: 0 });
}

/**
 * Sum of planned/estimated litres + estimatedCost over a refuel subset, mirroring
 * the backend's AggregationEngine.summarizeTotalsFromRefuels exactly (prefers
 * plannedFuelLitres over estimatedFuelLitres, excludes skipped rows) so pending
 * and whole-day estimates are computed identically.
 */
export function sumEstimatedFuelAndCost(refuels = []) {
  return refuels.reduce((acc, r) => {
    if (r.skippedAt != null) return acc;
    const planned = r.plannedFuelLitres != null ? Number(r.plannedFuelLitres) : null;
    const litres = (planned != null && Number.isFinite(planned) && planned > 0)
      ? planned : (Number(r.estimatedFuelLitres) || 0);
    const c = Number(r.estimatedCost);
    return { litres: acc.litres + litres, cost: acc.cost + (Number.isFinite(c) ? c : 0) };
  }, { litres: 0, cost: 0 });
}

/**
 * Fueling Day status in operations language (derived; the database still stores
 * draft/approved/locked):
 *  - planning: still being prepared
 *  - inProgress: approved and fueling underway
 *  - completed: approved and every vehicle is fueled or skipped
 *  - closed: locked
 */
export function deriveFuelingDayStatus({ operation, details } = {}) {
  const status = String(
    details?.effectiveStatus || operation?.effectiveStatus || operation?.status || '',
  ).toLowerCase();
  if (status === 'locked') return 'closed';
  if (status === 'draft' || status === '') return 'planning';
  const refuels = details?.refuels || [];
  const selected = refuels.length;
  const handled = refuels.filter((r) => isRefuelComplete(r) || isRefuelSkipped(r)).length;
  if (selected > 0 && handled === selected) return 'completed';
  return 'inProgress';
}

export const FUELING_DAY_STATUS_LABEL = {
  planning: 'Planning',
  inProgress: 'In Progress',
  completed: 'Completed',
  closed: 'Closed',
};

export function fuelingDayStatusColor(status) {
  switch (status) {
    case 'completed': return 'success';
    case 'inProgress': return 'primary';
    case 'closed': return 'default';
    case 'planning':
    default: return 'warning';
  }
}

/**
 * Smart Invoice attachment stages in operations language:
 *  - attached: file linked, no litres extracted yet
 *  - processed: litres extracted, not yet reconciled against dispensed total
 *  - reconciled: litres compared to the day (matched or variance)
 */
export function deriveInvoiceStage(invoice) {
  const reconciliation = String(invoice?.reconciliationStatus || '').toLowerCase();
  if (reconciliation === 'matched' || reconciliation === 'variance') return 'reconciled';
  if (invoice?.extractionPending === false) return 'processed';
  return 'attached';
}

export const INVOICE_STAGE_LABEL = {
  attached: 'Attached',
  processed: 'Processed',
  reconciled: 'Reconciled',
};

export function invoiceStageColor(stage) {
  switch (stage) {
    case 'reconciled': return 'success';
    case 'processed': return 'info';
    case 'attached':
    default: return 'default';
  }
}

/** MUI color for a planned-vs-actual variance: <5% ok, <10% warning, else error. */
export function varianceTone(planned, actual) {
  const p = Number(planned);
  const a = Number(actual);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(a)) return 'default';
  const pct = Math.abs(((a - p) / p) * 100);
  if (pct < 5) return 'success';
  if (pct < 10) return 'warning';
  return 'error';
}

export function sumPlannedLitres(refuels = []) {
  return refuels.reduce((acc, r) => {
    const p = r.plannedFuelLitres != null ? Number(r.plannedFuelLitres) : null;
    if (p != null && Number.isFinite(p) && p > 0) return acc + p;
    const e = r.estimatedFuelLitres != null ? Number(r.estimatedFuelLitres) : 0;
    return acc + (Number.isFinite(e) ? e : 0);
  }, 0);
}

/** Fueling Day step states: Prepare / Fuel vehicles / Smart invoice / Review. */
export function deriveOperationSteps({ operation, details } = {}) {
  const status = String(
    details?.effectiveStatus
    || operation?.effectiveStatus
    || operation?.status
    || '',
  ).toLowerCase();

  const refuels = details?.refuels || [];
  const hasPlan = refuels.length > 0;
  const completed = refuels.filter(isRefuelComplete).length;
  const skipped = refuels.filter(isRefuelSkipped).length;
  // The day's fueling work is done once every planned vehicle is fueled or skipped.
  const allHandled = hasPlan && (completed + skipped) === refuels.length;
  const isApproved = status === 'approved';
  const isLocked = status === 'locked';

  // The invoice step is complete once an attachment exists — extraction and
  // reconciliation are separate stages tracked on the Invoices screen itself.
  const summary = details?.invoiceSummary;
  const invoices = details?.invoices || [];
  const hasAttachment = invoices.some((i) => i.attachmentUrl)
    || (summary ? summary.count > 0 : Boolean(details?.invoice));

  return {
    prepare: { done: isApproved || isLocked, active: !isApproved && !isLocked },
    fuel: { done: allHandled || isLocked, active: isApproved && !allHandled },
    invoice: { done: hasAttachment, active: (isApproved || isLocked) && allHandled && !hasAttachment },
    review: { done: isLocked, active: hasAttachment && !isLocked },
  };
}
