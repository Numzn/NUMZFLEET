import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompletionPatch } from './completionPatch.js';

test('completing a service always marks it completed', () => {
  assert.deepEqual(buildCompletionPatch({}), { status: 'completed' });
});

test('the completion date is passed through when given', () => {
  assert.equal(buildCompletionPatch({ completedAt: '2026-10-16T00:00:00.000Z' }).completedAt, '2026-10-16T00:00:00.000Z');
});

test('the typed completion odometer is only called a dashboard reading when the person attests to it', () => {
  const attested = buildCompletionPatch({ odometerKm: '120450', odometerConfirmedPhysical: true });
  assert.equal(attested.odometerConfirmedPhysical, true);
  const unattested = buildCompletionPatch({ odometerKm: '120450', odometerConfirmedPhysical: false });
  assert.equal('odometerConfirmedPhysical' in unattested, false);
  const truthyLookalike = buildCompletionPatch({ odometerKm: '120450', odometerConfirmedPhysical: 'yes' });
  assert.equal('odometerConfirmedPhysical' in truthyLookalike, false);
});

test('an attestation without an odometer value is meaningless and is not sent', () => {
  assert.equal('odometerConfirmedPhysical' in buildCompletionPatch({ odometerKm: '', odometerConfirmedPhysical: true }), false);
  assert.equal('odometerConfirmedPhysical' in buildCompletionPatch({ odometerConfirmedPhysical: true }), false);
});

test('a correction reason is trimmed and sent only alongside an odometer value', () => {
  assert.equal(buildCompletionPatch({ odometerKm: '100', odometerReason: '  Cluster replaced ' }).odometerReason, 'Cluster replaced');
  assert.equal('odometerReason' in buildCompletionPatch({ odometerKm: '100', odometerReason: '   ' }), false);
  assert.equal('odometerReason' in buildCompletionPatch({ odometerReason: 'orphan' }), false);
});
