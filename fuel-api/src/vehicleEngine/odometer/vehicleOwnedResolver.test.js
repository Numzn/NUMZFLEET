/**
 * The canonical odometer resolver, reading the VEHICLE's anchor (vehicle_odometer_anchors) instead of a
 * device-keyed vehicle_specs row. Pure tests: anchors are plain objects, collaborators are injected.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/test';

const { resolveOdometerKm } = await import('./resolveOdometer.js');
const { resolveOdometerFromEvidence } = await import('./resolveVehicleOdometer.js');
const { anchorToEvidence, buildEvidenceFromBatch, collectEvidence } = await import('./collectEvidence.js');
const { toMergedDto } = await import('../../services/vehicleFleetService.js');

const NOW = Date.now();
const live = { deviceStatus: 'online', deviceLastUpdate: new Date(NOW - 10_000).toISOString(), positionFixTime: new Date(NOW - 12_000).toISOString() };

const anchor = (over = {}) => ({
  id: 'anchor-1',
  vehicleId: 'veh-1',
  deviceId: 7,
  odometerKm: 125000,
  telemetryKm: 4000,
  kind: 'observation',
  state: 'physically_verified',
  source: 'manual',
  observedAt: new Date('2026-10-01T08:00:00Z'),
  ...over,
});

const resolve = ({ rawTotalDistanceM, anchorRow, deviceId = 7 }) => resolveOdometerFromEvidence(buildEvidenceFromBatch({
  ...live,
  positionAttributes: rawTotalDistanceM == null ? null : { totalDistance: rawTotalDistanceM },
  anchor: anchorRow,
  deviceId,
}));

test('a pending baseline holds the accepted mileage; it does not fall back to the new tracker\'s own counter', () => {
  // Before: anchor 125,000 km with no tracker reference + a tracker counter of 5 km => "5 km" (telemetry_only).
  const result = resolveOdometerKm({ anchorKm: 125000, anchorTelemetryKm: null, currentTelemetryKm: 5 });
  assert.deepEqual(result, { odometerKm: 125000, resolutionMode: 'anchored' });
});

test('without an anchor the resolver is unchanged: telemetry only, or unavailable', () => {
  assert.deepEqual(resolveOdometerKm({ anchorKm: null, anchorTelemetryKm: null, currentTelemetryKm: 4400 }),
    { odometerKm: 4400, resolutionMode: 'telemetry_only' });
  assert.deepEqual(resolveOdometerKm({ anchorKm: null, anchorTelemetryKm: null, currentTelemetryKm: null }),
    { odometerKm: null, resolutionMode: 'unavailable' });
});

test('anchorToEvidence: a vehicle anchor becomes resolver evidence for the tracker it belongs to', () => {
  const evidence = anchorToEvidence(anchor(), { deviceId: 7 });
  assert.equal(evidence.anchorKm, 125000);
  assert.equal(evidence.anchorTelemetryKm, 4000);
  assert.equal(evidence.anchorState, 'physically_verified');
  assert.equal(evidence.deviceMismatch, false);
  assert.equal(anchorToEvidence(null, { deviceId: 7 }), null);
});

test('anchorToEvidence: an anchor taken on a different tracker\'s counter is not applied to this one', () => {
  const evidence = anchorToEvidence(anchor({ deviceId: 7 }), { deviceId: 9 });
  assert.equal(evidence.deviceMismatch, true);
  assert.equal(evidence.anchorTelemetryKm, null, 'the other tracker\'s counter reference is dropped');
  assert.equal(evidence.anchorKm, 125000, 'the vehicle\'s accepted mileage is kept');
});

test('anchorToEvidence: a vehicle with no tracker yet keeps its accepted mileage', () => {
  const evidence = anchorToEvidence(anchor({ deviceId: null, telemetryKm: null }), { deviceId: null });
  assert.equal(evidence.deviceMismatch, false);
  assert.equal(evidence.anchorKm, 125000);
});

test('normal operation: accepted mileage plus the distance the tracker counted since the anchor', () => {
  const state = resolve({ rawTotalDistanceM: 4400 * 1000, anchorRow: anchor() });
  assert.equal(state.odometerKm, 125400);
  assert.equal(state.resolutionMode, 'anchored');
  assert.equal(state.verification, 'physical');
  assert.equal(state.reconciliation, 'established');
  assert.equal(state.odometerConfidence, 'high');
});

test('a replacement tracker with a counter that starts at zero continues from the carried mileage', () => {
  const carried = anchor({ id: 'a2', kind: 'tracker_replacement', state: 'provisional', deviceId: 9, odometerKm: 125400, telemetryKm: 0 });
  const state = resolve({ rawTotalDistanceM: 120 * 1000, anchorRow: carried, deviceId: 9 });
  assert.equal(state.odometerKm, 125520);
});

test('a replacement tracker with a lifetime counter that does not start at zero uses the counter at hand-over', () => {
  const carried = anchor({ id: 'a2', kind: 'tracker_replacement', state: 'provisional', deviceId: 9, odometerKm: 125400, telemetryKm: 80000 });
  const state = resolve({ rawTotalDistanceM: 80120 * 1000, anchorRow: carried, deviceId: 9 });
  assert.equal(state.odometerKm, 125520, 'only the 120 km driven since hand-over counts, not the tracker\'s lifetime 80,120');
});

test('a provisional baseline is labelled as such, estimated, and never above medium confidence', () => {
  const carried = anchor({ state: 'provisional', kind: 'tracker_replacement', deviceId: 9, telemetryKm: 0 });
  const state = resolve({ rawTotalDistanceM: 50 * 1000, anchorRow: carried, deviceId: 9 });
  assert.equal(state.verification, 'estimated');
  assert.equal(state.reconciliation, 'provisional');
  assert.notEqual(state.odometerConfidence, 'high');
});

test('awaiting the new tracker: the mileage holds at the last accepted value, flagged, with lowered confidence', () => {
  const waiting = anchor({ state: 'awaiting_tracker', kind: 'tracker_replacement', deviceId: 9, telemetryKm: null, odometerKm: 125400 });
  const state = resolve({ rawTotalDistanceM: 5 * 1000, anchorRow: waiting, deviceId: 9 });
  assert.equal(state.odometerKm, 125400, 'not 5 km, and not advanced by an unreconciled counter');
  assert.equal(state.reconciliation, 'awaiting_tracker');
  assert.equal(state.baselinePending, true);
  assert.ok(state.diagnostics.includes('baseline_pending'));
  assert.notEqual(state.odometerConfidence, 'high');
});

test('an anchor belonging to another tracker is never advanced by this tracker\'s counter', () => {
  const state = resolve({ rawTotalDistanceM: 90000 * 1000, anchorRow: anchor({ deviceId: 7 }), deviceId: 9 });
  assert.equal(state.odometerKm, 125000);
  assert.ok(state.diagnostics.includes('anchor_device_mismatch'));
});

test('a legacy anchor behaves as before, but is reported as unverified, never physical', () => {
  const state = resolve({ rawTotalDistanceM: 4400 * 1000, anchorRow: anchor({ kind: 'legacy_migration', state: 'legacy_unverified' }) });
  assert.equal(state.odometerKm, 125400);
  assert.equal(state.verification, 'unverified_legacy');
  assert.equal(state.odometerConfidence, 'high', 'no silent confidence drop at deploy');
});

test('a trusted estimate is not a physical verification', () => {
  const state = resolve({ rawTotalDistanceM: 4400 * 1000, anchorRow: anchor({ state: 'trusted_estimate' }) });
  assert.equal(state.verification, 'estimated');
  assert.notEqual(state.odometerConfidence, 'high');
});

test('no anchor at all: tracker evidence only, labelled estimated', () => {
  const state = resolve({ rawTotalDistanceM: 4400 * 1000, anchorRow: null });
  assert.equal(state.odometerKm, 4400);
  assert.equal(state.resolutionMode, 'telemetry_only');
  assert.equal(state.verification, 'estimated');
  assert.equal(state.reconciliation, 'none');
});

test('nothing at all: unavailable', () => {
  const state = resolve({ rawTotalDistanceM: null, anchorRow: null });
  assert.equal(state.odometerKm, null);
  assert.equal(state.verification, 'none');
  assert.equal(state.odometerConfidence, 'unavailable');
});

test('the anchor\'s observation time is exposed so a screen can show how old the baseline is', () => {
  const state = resolve({ rawTotalDistanceM: 4400 * 1000, anchorRow: anchor() });
  assert.equal(new Date(state.anchorObservedAt).toISOString(), '2026-10-01T08:00:00.000Z');
  assert.equal(state.anchorId, 'anchor-1');
});

// ---- the fleet list path -------------------------------------------------------------------------

const VEHICLE = { id: 'veh-1', name: 'ALLION', plateNumber: 'CAC 4222', companyId: 'co-1' };
const assignment = { deviceId: 7, assignedAt: new Date('2026-09-01T00:00:00Z') };
const rows = (attrs) => ({
  deviceMap: new Map([[7, { id: 7, name: 'ALLION', status: 'online', lastupdate: live.deviceLastUpdate, attributes: {} }]]),
  positionMap: new Map([[7, { deviceId: 7, latitude: -15.4, longitude: 28.3, speed: 0, fixtime: live.positionFixTime, attributes: attrs }]]),
});

test('toMergedDto reads the vehicle\'s anchor from anchorMap', () => {
  const { deviceMap, positionMap } = rows({ totalDistance: 4400 * 1000 });
  const dto = toMergedDto(VEHICLE, assignment, deviceMap, positionMap, new Map(), new Map([['veh-1', anchor()]]));
  assert.equal(dto.odometerKm, 125400);
  assert.equal(dto.odometerVerification, 'physical');
  assert.equal(dto.odometerReconciliation, 'established');
});

test('CONTAMINATION GUARD: a verified odometer left on the tracker\'s spec row is never used as the vehicle\'s anchor', () => {
  const { deviceMap, positionMap } = rows({ totalDistance: 9100 * 1000 });
  // Another vehicle's anchor sits on device 7's legacy spec row.
  const staleSpec = new Map([[7, { deviceId: 7, tankCapacity: 60, verifiedOdometerKm: 80000, verifiedTraccarDistance: 9000, verifiedOdometerAt: '2026-07-01T00:00:00Z' }]]);
  const dto = toMergedDto(VEHICLE, assignment, deviceMap, positionMap, staleSpec, new Map());
  assert.equal(dto.odometerKm, 9100, 'telemetry only; the other vehicle\'s 80,000 km is ignored');
  assert.notEqual(dto.odometerKm, 80100);
  assert.equal(dto.odometerVerification, 'estimated');
});

test('the vehicle keeps its mileage in the fleet list when its tracker changes', () => {
  const { deviceMap, positionMap } = rows({ totalDistance: 130 * 1000 });
  const carried = anchor({ id: 'a2', deviceId: 7, state: 'provisional', kind: 'tracker_replacement', odometerKm: 125400, telemetryKm: 100 });
  const dto = toMergedDto(VEHICLE, assignment, deviceMap, positionMap, new Map(), new Map([['veh-1', carried]]));
  assert.equal(dto.odometerKm, 125430);
});

// ---- the single-device path ------------------------------------------------------------------------

const deps = (over = {}) => ({
  getVehicleTelemetry: async () => ({ ...live, positionAttributes: { totalDistance: 4400 * 1000 } }),
  findVehicleIdForDevice: async () => 'veh-1',
  findCurrentAnchor: async () => anchor(),
  findTrackerState: async () => null,
  ...over,
});

test('collectEvidence finds the vehicle through the tracker\'s active assignment and applies the vehicle\'s anchor', async () => {
  const evidence = await collectEvidence({ merged: { position: null, device: null }, deviceId: 7 }, deps());
  assert.equal(evidence.anchor.anchorKm, 125000);
  assert.equal(evidence.hasObservation, true);
});

test('collectEvidence uses the vehicle id it was given without a second lookup', async () => {
  let lookups = 0;
  await collectEvidence({ merged: { id: 'veh-1' }, deviceId: 7 }, deps({ findVehicleIdForDevice: async () => { lookups += 1; return 'other'; } }));
  assert.equal(lookups, 0);
});

test('collectEvidence: a tracker with no active vehicle has no anchor (nothing is borrowed from the tracker)', async () => {
  let asked = 0;
  const evidence = await collectEvidence({ merged: { position: null, device: null }, deviceId: 7 }, deps({
    findVehicleIdForDevice: async () => null,
    findCurrentAnchor: async () => { asked += 1; return anchor(); },
  }));
  assert.equal(evidence.anchor, null);
  assert.equal(asked, 0);
});

test('collectEvidence: the anchor of a different tracker is not applied to this one', async () => {
  const evidence = await collectEvidence({ merged: { id: 'veh-1' }, deviceId: 9 }, deps({ findCurrentAnchor: async () => anchor({ deviceId: 7 }) }));
  assert.equal(evidence.anchor.deviceMismatch, true);
  assert.equal(evidence.anchor.anchorTelemetryKm, null);
});

test('a vehicle with no tracker keeps showing its accepted odometer, held and flagged (it is not blank)', () => {
  const removed = anchor({ kind: 'tracker_removal', state: 'trusted_estimate', deviceId: null, telemetryKm: null, odometerKm: 125400 });
  const dto = toMergedDto(VEHICLE, null, new Map(), new Map(), new Map(), new Map([['veh-1', removed]]));
  assert.equal(dto.odometerKm, 125400);
  assert.equal(dto.odometerReconciliation, 'awaiting_tracker');
  assert.equal(dto.odometerBaselinePending, true);
  assert.equal(dto.odometerVerification, 'estimated');
  assert.equal(dto.odometerConfidence, 'low', 'held with no live evidence: it cannot be presented as a live reading');
  assert.equal(dto.assignment, null);
});

test('a vehicle with no tracker and no anchor is still unavailable', () => {
  const dto = toMergedDto(VEHICLE, null, new Map(), new Map(), new Map(), new Map());
  assert.equal(dto.odometerKm, null);
  assert.equal(dto.odometerConfidence, 'unavailable');
  assert.equal(dto.odometerVerification, 'none');
});

test('collectEvidence: a vehicle with no tracker still resolves its own accepted mileage', async () => {
  const held = anchor({ kind: 'tracker_removal', state: 'trusted_estimate', deviceId: null, telemetryKm: null, odometerKm: 125400 });
  const evidence = await collectEvidence({ merged: { id: 'veh-1' }, deviceId: null }, deps({ findCurrentAnchor: async () => held }));
  assert.equal(evidence.anchor.anchorKm, 125400);
  const state = resolveOdometerFromEvidence(evidence);
  assert.equal(state.odometerKm, 125400);
  assert.equal(state.reconciliation, 'awaiting_tracker');
});

// ---- the accepted counter: raw glitches never reach the odometer ----------------------------------------

const ACCEPTED = (acceptedKm, extra = {}) => ({ acceptedKm, source: 'accepted', quarantined: false, pendingKind: null, ...extra });
const resolveWith = ({ rawTotalDistanceM, anchorRow, acceptedCounter, deviceId = 7 }) => resolveOdometerFromEvidence(buildEvidenceFromBatch({
  ...live,
  positionAttributes: rawTotalDistanceM == null ? null : { totalDistance: rawTotalDistanceM },
  anchor: anchorRow,
  deviceId,
  acceptedCounter,
}));

test('the odometer follows the ACCEPTED counter, not whatever the tracker last said', () => {
  // the tracker's raw counter just glitched to 99,999 km; the accepted counter is still 4,400
  const state = resolveWith({ rawTotalDistanceM: 99_999_000, anchorRow: anchor(), acceptedCounter: ACCEPTED(4400) });
  assert.equal(state.odometerKm, 125400);
  assert.equal(state.readingStatus, 'accepted');
});

test('a counter reset does not freeze the odometer: the accepted counter carries on across it', () => {
  // anchor taken at accepted counter 4,000; the tracker then reset to near zero, but the accepted counter
  // is continuous (it was 4,010 at the reset and 4,030 now)
  const state = resolveWith({ rawTotalDistanceM: 20_000, anchorRow: anchor(), acceptedCounter: ACCEPTED(4030) });
  assert.equal(state.odometerKm, 125030);
  assert.ok(!state.diagnostics.includes('reset_suspected'), 'the reset has been handled upstream; it is not a frozen odometer');
});

test('a quarantined reading is reported, lowers confidence, and still does not move the odometer', () => {
  const state = resolveWith({
    rawTotalDistanceM: 9_000_000,
    anchorRow: anchor(),
    acceptedCounter: ACCEPTED(4400, { quarantined: true, pendingKind: 'jump' }),
  });
  assert.equal(state.odometerKm, 125400);
  assert.equal(state.readingStatus, 'quarantined');
  assert.ok(state.diagnostics.includes('reading_quarantined'));
  assert.notEqual(state.odometerConfidence, 'high');
});

test('a tracker the ingest has not met yet falls back to its raw counter, flagged as not yet validated', () => {
  const state = resolveWith({
    rawTotalDistanceM: 4400 * 1000,
    anchorRow: anchor(),
    acceptedCounter: { acceptedKm: 4400, source: 'raw', quarantined: false, pendingKind: null },
  });
  assert.equal(state.odometerKm, 125400, 'nothing changes at the moment this ships');
  assert.equal(state.readingStatus, 'unvalidated');
  assert.ok(state.diagnostics.includes('counter_unvalidated'));
  assert.equal(state.odometerConfidence, 'high', 'informational only: no confidence drop for being new');
});

test('the accepted counter is already unit-corrected, so no second unit guess is applied to it', () => {
  const state = resolveWith({ rawTotalDistanceM: 5_000_000_000, anchorRow: anchor(), acceptedCounter: ACCEPTED(4400) });
  assert.ok(!state.diagnostics.includes('unit_mismatch_suspected'));
});

test('the fleet list resolves a glitching tracker from its accepted counter', () => {
  const { deviceMap, positionMap } = rows({ totalDistance: 88_000_000 }); // raw says 88,000 km
  const stateMap = new Map([[7, { deviceId: 7, acceptedKm: 4400, rawKm: 4400, fixTime: new Date(NOW - 60_000), positionId: 10, positionCursor: 10, pending: null }]]);
  const dto = toMergedDto(VEHICLE, assignment, deviceMap, positionMap, new Map(), new Map([['veh-1', anchor()]]), stateMap);
  assert.equal(dto.odometerKm, 125400);
  assert.equal(dto.odometerReadingStatus, 'quarantined', 'the glitch is held out of the mileage, and says so');
});

test('the fleet list reports a healthy tracker\'s reading as accepted', () => {
  const { deviceMap, positionMap } = rows({ totalDistance: 4402_000 });
  const stateMap = new Map([[7, { deviceId: 7, acceptedKm: 4400, rawKm: 4400, fixTime: new Date(NOW - 60_000), positionId: 10, positionCursor: 10, pending: null }]]);
  const dto = toMergedDto(VEHICLE, assignment, deviceMap, positionMap, new Map(), new Map([['veh-1', anchor()]]), stateMap);
  assert.equal(dto.odometerKm, 125402);
  assert.equal(dto.odometerReadingStatus, 'accepted');
});

test('collectEvidence uses the remembered state to hold a jump out of the odometer', async () => {
  const row = { deviceId: 7, acceptedKm: 4400, rawKm: 4400, fixTime: new Date(NOW - 120_000), positionId: 10, positionCursor: 10, attribute: 'totalDistance', pending: null };
  const evidence = await collectEvidence({ merged: { id: 'veh-1' }, deviceId: 7 }, deps({
    getVehicleTelemetry: async () => ({ ...live, positionId: 11, positionAttributes: { totalDistance: 9_900_000 } }), // a +5,500 km jump
    findTrackerState: async () => row,
  }));
  assert.equal(evidence.telemetryKm, 4400, 'the jump is held out');
  assert.equal(evidence.acceptance.quarantined, true);
  const state = resolveOdometerFromEvidence(evidence);
  assert.equal(state.odometerKm, 125400);
  assert.equal(state.readingStatus, 'quarantined');
});

test('collectEvidence without a remembered state behaves as before (raw counter, flagged unvalidated)', async () => {
  const evidence = await collectEvidence({ merged: { id: 'veh-1' }, deviceId: 7 }, deps({ findTrackerState: async () => null }));
  assert.equal(evidence.telemetryKm, 4400);
  assert.equal(evidence.acceptance.source, 'raw');
});

test('a tracker\'s state from a different vehicle is not used for this one', async () => {
  const row = { deviceId: 7, vehicleId: 'someone-else', acceptedKm: 80000, rawKm: 80000, fixTime: new Date(NOW), positionId: 10, positionCursor: 10, pending: null };
  const evidence = await collectEvidence({ merged: { id: 'veh-1' }, deviceId: 7 }, deps({ findTrackerState: async () => row }));
  assert.equal(evidence.acceptance.source, 'raw');
  assert.equal(evidence.telemetryKm, 4400);
});

test('the result says when the accepted evidence was taken, separately from how new the raw position is', () => {
  const at = Date.parse('2026-10-16T09:30:00Z');
  const state = resolveWith({
    rawTotalDistanceM: 99_999_000,
    anchorRow: anchor(),
    acceptedCounter: ACCEPTED(4400, { quarantined: true, pendingKind: 'jump', acceptedAtMs: at }),
  });
  assert.equal(new Date(state.evidenceAt).toISOString(), '2026-10-16T09:30:00.000Z');
  const dto = toMergedDto(VEHICLE, assignment, rows({ totalDistance: 4400_000 }).deviceMap, rows({ totalDistance: 4400_000 }).positionMap, new Map(), new Map([['veh-1', anchor()]]), new Map());
  assert.equal(dto.odometerEvidenceAt, new Date(live.positionFixTime).toISOString(), 'with no remembered state it is the latest raw fix');
});

test('a vehicle held with no tracker has no evidence time', () => {
  const held = anchor({ kind: 'tracker_removal', state: 'trusted_estimate', deviceId: null, telemetryKm: null });
  const dto = toMergedDto(VEHICLE, null, new Map(), new Map(), new Map(), new Map([['veh-1', held]]));
  assert.equal(dto.odometerEvidenceAt, null);
});
