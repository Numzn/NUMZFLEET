import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChronologicalPreviousRefuel } from './fuelLearningPairing.js';

test('resolveChronologicalPreviousRefuel returns immediate predecessor', () => {
  const rows = [
    { id: 1, sessionDate: '2026-01-01' },
    { id: 2, sessionDate: '2026-01-15' },
    { id: 3, sessionDate: '2026-02-01' },
  ];
  assert.equal(resolveChronologicalPreviousRefuel(rows, 3)?.id, 2);
  assert.equal(resolveChronologicalPreviousRefuel(rows, 2)?.id, 1);
  assert.equal(resolveChronologicalPreviousRefuel(rows, 1), null);
});

test('resolveChronologicalPreviousRefuel does not use wrong fallback for unknown id', () => {
  const rows = [
    { id: 10, sessionDate: '2026-01-01' },
    { id: 20, sessionDate: '2026-02-01' },
  ];
  assert.equal(resolveChronologicalPreviousRefuel(rows, 999), null);
});

test('resolveChronologicalPreviousRefuel handles unsorted input', () => {
  const rows = [
    { id: 3, sessionDate: '2026-03-01' },
    { id: 1, sessionDate: '2026-01-01' },
    { id: 2, sessionDate: '2026-02-01' },
  ];
  assert.equal(resolveChronologicalPreviousRefuel(rows, 3)?.id, 2);
});
