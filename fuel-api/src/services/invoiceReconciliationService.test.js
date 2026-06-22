import test from 'node:test';
import assert from 'node:assert/strict';

// invoiceReconciliationService transitively imports the Sequelize model graph,
// which requires a database URL at import time (no connection is opened on
// import). Provide a dummy URL so the pure reconcile helper can be tested.
process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

const { reconcileInvoice, summarizeInvoices } = await import('./invoiceReconciliationService.js');

test('matches when within the absolute 1 litre tolerance', () => {
  const result = reconcileInvoice({ invoiceTotalLitres: 200.5, sessionActualLitres: 200 });
  assert.equal(result.status, 'matched');
  assert.equal(result.varianceLitres, 0.5);
});

test('matches when within the 0.5 percent relative tolerance on large volumes', () => {
  const result = reconcileInvoice({ invoiceTotalLitres: 1004, sessionActualLitres: 1000 });
  assert.equal(result.status, 'matched');
  assert.equal(result.varianceLitres, 4);
});

test('flags a variance beyond tolerance', () => {
  const result = reconcileInvoice({ invoiceTotalLitres: 220, sessionActualLitres: 200 });
  assert.equal(result.status, 'variance');
  assert.equal(result.varianceLitres, 20);
});

test('negative variance (under-delivered) is reported', () => {
  const result = reconcileInvoice({ invoiceTotalLitres: 180, sessionActualLitres: 200 });
  assert.equal(result.status, 'variance');
  assert.equal(result.varianceLitres, -20);
});

test('summarizeInvoices reports pending when there are no invoices', () => {
  const summary = summarizeInvoices([], { sessionActualLitres: 500, sessionActualCost: 9000 });
  assert.equal(summary.count, 0);
  assert.equal(summary.status, 'pending');
  assert.equal(summary.totalInvoiceLitres, 0);
  assert.equal(summary.varianceLitres, null);
});

test('summarizeInvoices sums multiple invoices and matches against the dispensed total', () => {
  const summary = summarizeInvoices(
    [
      { totalLitres: 300, totalCost: 5400 },
      { totalLitres: 200.5, totalCost: 3600 },
    ],
    { sessionActualLitres: 500, sessionActualCost: 9000 },
  );
  assert.equal(summary.count, 2);
  assert.equal(summary.totalInvoiceLitres, 500.5);
  assert.equal(summary.totalInvoiceCost, 9000);
  assert.equal(summary.status, 'matched');
  assert.equal(summary.varianceLitres, 0.5);
});

test('summarizeInvoices flags a variance when the invoice sum drifts beyond tolerance', () => {
  const summary = summarizeInvoices(
    [
      { totalLitres: 300 },
      { totalLitres: 260 },
    ],
    { sessionActualLitres: 500 },
  );
  assert.equal(summary.count, 2);
  assert.equal(summary.totalInvoiceLitres, 560);
  assert.equal(summary.status, 'variance');
  assert.equal(summary.varianceLitres, 60);
});

test('summarizeInvoices falls back to diesel + petrol litres when totalLitres is absent', () => {
  const summary = summarizeInvoices(
    [{ dieselLitres: 120, petrolLitres: 80 }],
    { sessionActualLitres: 200 },
  );
  assert.equal(summary.totalInvoiceLitres, 200);
  assert.equal(summary.status, 'matched');
});

test('summarizeInvoices stays pending when attachments have not been extracted yet', () => {
  const summary = summarizeInvoices(
    [{ attachmentUrl: 'https://example.com/invoice.pdf', totalLitres: null }],
    { sessionActualLitres: 160 },
  );
  assert.equal(summary.count, 1);
  assert.equal(summary.pendingExtraction, 1);
  assert.equal(summary.status, 'pending');
  assert.equal(summary.varianceLitres, null);
});
