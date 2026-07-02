import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRoutineServiceStatus } from './routineServiceStatus.js';

test('deriveRoutineServiceStatus boundary values', () => {
  assert.deepEqual(deriveRoutineServiceStatus(1001), { status: 'on_track', statusLabel: 'On Track' });
  assert.deepEqual(deriveRoutineServiceStatus(1000), { status: 'upcoming', statusLabel: 'Upcoming Service' });
  assert.deepEqual(deriveRoutineServiceStatus(501), { status: 'upcoming', statusLabel: 'Upcoming Service' });
  assert.deepEqual(deriveRoutineServiceStatus(500), { status: 'due_soon', statusLabel: 'Due Soon' });
  assert.deepEqual(deriveRoutineServiceStatus(101), { status: 'due_soon', statusLabel: 'Due Soon' });
  assert.deepEqual(deriveRoutineServiceStatus(100), { status: 'prepare', statusLabel: 'Prepare for Service' });
  assert.deepEqual(deriveRoutineServiceStatus(1), { status: 'prepare', statusLabel: 'Prepare for Service' });
  assert.deepEqual(deriveRoutineServiceStatus(0), { status: 'due_now', statusLabel: 'Service Due' });
  assert.deepEqual(deriveRoutineServiceStatus(-1), { status: 'overdue', statusLabel: 'Overdue' });
  assert.deepEqual(deriveRoutineServiceStatus(null), { status: null, statusLabel: null });
});
