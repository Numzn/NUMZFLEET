import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInvoiceOcrText } from './parseInvoiceOcrText.js';

test('parseInvoiceOcrText extracts litres and total cost from receipt text', () => {
  const result = parseInvoiceOcrText(`
    PUMA FUEL STATION
    DIESEL 245.50 L
    TOTAL ZMW 4419.00
    RECEIPT INV-12345
  `);
  assert.equal(result.totalLitres, 245.5);
  assert.equal(result.totalCost, 4419);
  assert.equal(result.invoiceNumber, 'INV-12345');
});

test('parseInvoiceOcrText returns nulls for empty text', () => {
  const result = parseInvoiceOcrText('');
  assert.equal(result.totalLitres, null);
  assert.equal(result.totalCost, null);
});
