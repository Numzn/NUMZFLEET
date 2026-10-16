import test from 'node:test';
import assert from 'node:assert/strict';

import { buildObservationPayload, canSubmitObservation } from './odometerObservationPayload.js';

test('a dashboard reading is only sent as physically confirmed when the person attests to it', () => {
  assert.equal(buildObservationPayload({ odometerKm: '120450', attestedFromDashboard: true }).confirmedPhysical, true);
  assert.equal(buildObservationPayload({ odometerKm: '120450', attestedFromDashboard: false }).confirmedPhysical, false);
  assert.equal(buildObservationPayload({ odometerKm: '120450' }).confirmedPhysical, false);
  // only a real boolean true counts; truthy look-alikes never become an attestation
  assert.equal(buildObservationPayload({ odometerKm: 1, attestedFromDashboard: 'true' }).confirmedPhysical, false);
  assert.equal(buildObservationPayload({ odometerKm: 1, attestedFromDashboard: 1 }).confirmedPhysical, false);
});

test('the km is sent as a number and the source defaults to manual', () => {
  const p = buildObservationPayload({ odometerKm: '120450.5', attestedFromDashboard: true });
  assert.equal(p.odometerKm, 120450.5);
  assert.equal(p.source, 'manual');
  assert.equal(buildObservationPayload({ odometerKm: 5, attestedFromDashboard: true, source: 'audit' }).source, 'audit');
});

test('a reason is trimmed and only sent when there is one', () => {
  assert.equal(buildObservationPayload({ odometerKm: 5, attestedFromDashboard: true, reason: '  Cluster replaced  ' }).reason, 'Cluster replaced');
  assert.equal('reason' in buildObservationPayload({ odometerKm: 5, attestedFromDashboard: true, reason: '   ' }), false);
  assert.equal('reason' in buildObservationPayload({ odometerKm: 5, attestedFromDashboard: true }), false);
});

test('saving needs a valid km and the attestation', () => {
  assert.equal(canSubmitObservation({ odometerKm: '120450', attestedFromDashboard: true }), true);
  assert.equal(canSubmitObservation({ odometerKm: '120450', attestedFromDashboard: false }), false);
  assert.equal(canSubmitObservation({ odometerKm: '', attestedFromDashboard: true }), false);
  assert.equal(canSubmitObservation({ odometerKm: 'abc', attestedFromDashboard: true }), false);
  assert.equal(canSubmitObservation({ odometerKm: '-5', attestedFromDashboard: true }), false);
  assert.equal(canSubmitObservation({ odometerKm: '0', attestedFromDashboard: true }), true);
});
