import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEVICE_STATES,
  buildAssignmentIndex,
  classifyDevice,
  countTabs,
  csvCell,
  decorateDevices,
  filterRows,
  paginate,
  toCsv,
} from './deviceListModel.js';

// positionId is 0 (not null) for a tracker with no position: Traccar's Device.positionId
// is a primitive long. Trackers with no signal are presented as Offline.
const TRACCAR_NEVER = {
  id: 62, name: 'ALLION', uniqueId: '111111111111111', status: 'offline', lastUpdate: null, positionId: 0,
};
const TRACCAR_QUIET = {
  id: 7, name: 'Hilux', uniqueId: '222222222222222', status: 'offline', lastUpdate: '2026-10-01T08:00:00.000Z', positionId: 99,
};
const TRACCAR_LIVE = {
  id: 8, name: 'Corolla', uniqueId: '333333333333333', status: 'online', lastUpdate: '2026-10-05T09:00:00.000Z', positionId: 100,
};
const TRACCAR_UNKNOWN_BUT_SEEN = {
  id: 9, name: 'Spare', uniqueId: '444444444444444', status: 'unknown', lastUpdate: '2026-09-01T00:00:00.000Z', positionId: 5,
};

const VEHICLES = [
  { id: 'v-allion', name: 'ALLION', plateNumber: 'BAZ 123', assignment: { deviceId: 62, assignedAt: '2026-09-22T11:10:31.313Z' } },
  { id: 'v-hilux', name: 'Hilux', plateNumber: null, assignment: { deviceId: '7', assignedAt: '2026-09-01T00:00:00.000Z' } },
  { id: 'v-free', name: 'Parked truck', plateNumber: 'ABC 999', assignment: null },
];

test('classifyDevice maps never-reported trackers to offline', () => {
  assert.equal(classifyDevice(TRACCAR_LIVE), DEVICE_STATES.ONLINE);
  assert.equal(classifyDevice(TRACCAR_QUIET), DEVICE_STATES.OFFLINE);
  assert.equal(classifyDevice(TRACCAR_NEVER), DEVICE_STATES.OFFLINE);
  // status "unknown" with a recorded history is just a quiet tracker, not a new one
  assert.equal(classifyDevice(TRACCAR_UNKNOWN_BUT_SEEN), DEVICE_STATES.OFFLINE);
});

test('classifyDevice treats every non-online tracker as offline', () => {
  assert.equal(classifyDevice({ status: 'offline', lastUpdate: null, positionId: 3 }), DEVICE_STATES.OFFLINE);
  assert.equal(classifyDevice({ status: 'offline', lastUpdate: '2026-10-01T00:00:00Z', positionId: null }), DEVICE_STATES.OFFLINE);
  assert.equal(classifyDevice({ status: 'offline' }), DEVICE_STATES.OFFLINE);
  assert.equal(classifyDevice(undefined), DEVICE_STATES.OFFLINE);
  // every "no position" encoding Traccar / our own DTOs can produce
  [0, null, undefined].forEach((positionId) => {
    assert.equal(classifyDevice({ status: 'offline', lastUpdate: null, positionId }), DEVICE_STATES.OFFLINE, `positionId=${positionId}`);
  });
});

test('buildAssignmentIndex maps deviceId (number or numeric string) to its vehicle and skips unassigned vehicles', () => {
  const index = buildAssignmentIndex(VEHICLES);
  assert.equal(index.size, 2);
  assert.equal(index.get(62).name, 'ALLION');
  assert.equal(index.get(62).plateNumber, 'BAZ 123');
  assert.equal(index.get(62).assignedAt, '2026-09-22T11:10:31.313Z');
  assert.equal(index.get(7).vehicleId, 'v-hilux');
  assert.equal(index.get(7).plateNumber, null);
  assert.equal(buildAssignmentIndex(null).size, 0);
  assert.equal(buildAssignmentIndex([{ id: 'x', assignment: {} }]).size, 0);
});

test('an assigned device with no signal remains offline and assigned', () => {
  const rows = decorateDevices([TRACCAR_NEVER], buildAssignmentIndex(VEHICLES));
  assert.equal(rows[0].state, DEVICE_STATES.OFFLINE);
  assert.equal(rows[0].vehicle.name, 'ALLION');
  const counts = countTabs(rows, true);
  assert.deepEqual(counts, {
    all: 1, online: 0, offline: 1, unassigned: 0,
  });
});

test('countTabs: unassigned is null (not a misleading everything-count) when vehicles are unavailable', () => {
  const rows = decorateDevices([TRACCAR_NEVER, TRACCAR_LIVE], null);
  assert.equal(rows[0].vehicle, null);
  assert.equal(countTabs(rows, false).unassigned, null);
  assert.equal(countTabs(rows, true).unassigned, 2);
});

const ALL = decorateDevices(
  [TRACCAR_NEVER, TRACCAR_QUIET, TRACCAR_LIVE, TRACCAR_UNKNOWN_BUT_SEEN],
  buildAssignmentIndex(VEHICLES),
);

test('filterRows by tab', () => {
  assert.deepEqual(filterRows(ALL, { tab: 'all' }).map((r) => r.id), [62, 7, 8, 9]);
  assert.deepEqual(filterRows(ALL, { tab: 'online' }).map((r) => r.id), [8]);
  assert.deepEqual(filterRows(ALL, { tab: 'offline' }).map((r) => r.id), [62, 7, 9]);
  assert.deepEqual(filterRows(ALL, { tab: 'unassigned' }).map((r) => r.id), [8, 9]);
});

test('filterRows keyword matches name, IMEI, vehicle name and plate, case-insensitively, and combines with the tab', () => {
  assert.deepEqual(filterRows(ALL, { keyword: 'corolla' }).map((r) => r.id), [8]);
  assert.deepEqual(filterRows(ALL, { keyword: '2222' }).map((r) => r.id), [7]);
  assert.deepEqual(filterRows(ALL, { keyword: 'baz 123' }).map((r) => r.id), [62]);
  assert.deepEqual(filterRows(ALL, { keyword: '  HILUX ' }).map((r) => r.id), [7]);
  assert.deepEqual(filterRows(ALL, { tab: 'offline', keyword: 'hilux' }).map((r) => r.id), [7]);
  assert.deepEqual(filterRows(ALL, { tab: 'online', keyword: 'hilux' }), []);
  assert.deepEqual(filterRows(ALL, { keyword: 'zzz-no-match' }), []);
});

test('paginate clamps pages and reports the visible range', () => {
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: i }));
  const first = paginate(rows, 1, 10);
  assert.equal(first.items.length, 10);
  assert.deepEqual([first.from, first.to, first.total, first.pageCount], [1, 10, 23, 3]);
  const last = paginate(rows, 3, 10);
  assert.equal(last.items.length, 3);
  assert.deepEqual([last.from, last.to], [21, 23]);
  // after deleting down to one page the stale page number is clamped, not empty
  const clamped = paginate(rows.slice(0, 4), 3, 10);
  assert.equal(clamped.page, 1);
  assert.equal(clamped.items.length, 4);
  const empty = paginate([], 1, 10);
  assert.deepEqual([empty.items.length, empty.from, empty.to, empty.pageCount], [0, 0, 0, 1]);
});

test('csvCell quotes special characters and neutralises spreadsheet formulas', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(csvCell('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell(12345), '12345');
});

test('toCsv writes a header row from the record keys', () => {
  const csv = toCsv([
    { Name: 'ALLION', Vehicle: 'ALLION', Status: 'Never connected' },
    { Name: 'Hilux, 2', Vehicle: '', Status: 'Offline' },
  ]);
  assert.equal(csv, 'Name,Vehicle,Status\r\nALLION,ALLION,Never connected\r\n"Hilux, 2",,Offline\r\n');
  assert.equal(toCsv([]), '');
});
