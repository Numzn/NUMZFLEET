import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveVehicleWorkflowState,
  summarizeRefuelBuckets,
  deriveFuelingDayStatus,
  deriveInvoiceStage,
  deriveOperationSteps,
} from './operationDayUtils.js';

test('deriveVehicleWorkflowState derives state from refuel fields', () => {
  assert.equal(deriveVehicleWorkflowState({}), 'planned');
  assert.equal(deriveVehicleWorkflowState({ arrivedAt: '2026-06-21T08:00:00Z' }), 'arrived');
  assert.equal(deriveVehicleWorkflowState({ actualFuelLitres: 40 }), 'fueled');
  assert.equal(deriveVehicleWorkflowState({ skippedAt: '2026-06-21T09:00:00Z' }), 'skipped');
});

test('deriveVehicleWorkflowState prefers the backend workflowStatus', () => {
  assert.equal(deriveVehicleWorkflowState({ workflowStatus: 'arrived', actualFuelLitres: 40 }), 'arrived');
});

test('summarizeRefuelBuckets excludes skipped vehicles from missing', () => {
  const buckets = summarizeRefuelBuckets([
    { actualFuelLitres: 40 },
    { arrivedAt: '2026-06-21T08:00:00Z' },
    { skippedAt: '2026-06-21T09:00:00Z' },
    {},
  ]);
  assert.equal(buckets.selected, 4);
  assert.equal(buckets.fueled, 1);
  assert.equal(buckets.skipped, 1);
  assert.equal(buckets.arrived, 2); // arrived row + the fueled row
  assert.equal(buckets.missing, 2); // selected - fueled - skipped
});

test('deriveFuelingDayStatus maps lifecycle to operations language', () => {
  assert.equal(deriveFuelingDayStatus({ operation: { status: 'draft' } }), 'planning');
  assert.equal(deriveFuelingDayStatus({ operation: { status: 'locked' } }), 'closed');
  assert.equal(
    deriveFuelingDayStatus({ operation: { status: 'approved' }, details: { refuels: [{}, { actualFuelLitres: 40 }] } }),
    'inProgress',
  );
  assert.equal(
    deriveFuelingDayStatus({
      operation: { status: 'approved' },
      details: { refuels: [{ actualFuelLitres: 40 }, { skippedAt: 'x' }] },
    }),
    'completed',
  );
});

test('deriveInvoiceStage walks attached -> processed -> reconciled', () => {
  assert.equal(deriveInvoiceStage({ attachmentUrl: 'https://x', extractionPending: true }), 'attached');
  assert.equal(deriveInvoiceStage({ extractionPending: false, reconciliationStatus: 'pending' }), 'processed');
  assert.equal(deriveInvoiceStage({ reconciliationStatus: 'matched' }), 'reconciled');
  assert.equal(deriveInvoiceStage({ reconciliationStatus: 'variance' }), 'reconciled');
});

test('deriveOperationSteps completes the invoice step on attachment, not reconciliation', () => {
  const steps = deriveOperationSteps({
    operation: { status: 'approved' },
    details: {
      refuels: [{ actualFuelLitres: 40 }],
      invoices: [{ attachmentUrl: 'https://x', extractionPending: true, reconciliationStatus: 'pending' }],
    },
  });
  assert.equal(steps.fuel.done, true);
  assert.equal(steps.invoice.done, true);
});

test('deriveOperationSteps treats a fully skipped/fueled plan as fueled', () => {
  const steps = deriveOperationSteps({
    operation: { status: 'approved' },
    details: { refuels: [{ actualFuelLitres: 40 }, { skippedAt: 'x' }] },
  });
  assert.equal(steps.fuel.done, true);
});
