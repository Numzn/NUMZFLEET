import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDocumentFacts } from './documentFactParser.js';

test('parseDocumentFacts extracts expiry and compliance hints', () => {
  const raw = `
    MOTOR VEHICLE INSURANCE CERTIFICATE
    Policy Number: POL-12345-ZM
    Valid until 15 March 2027
  `;
  const facts = parseDocumentFacts(raw, { category: 'insurance' });
  assert.equal(facts.suggestedComplianceType, 'INSURANCE');
  assert.equal(facts.suggestedExpiryDate, '2027-03-15');
  assert.equal(facts.documentProfile, 'single');
  assert.equal(facts.suggestedComplianceItems.length, 1);
  assert.ok(facts.detectedDocumentNumbers.includes('POL-12345-ZM'));
  assert.ok(facts.confidence > 0.5);
});

test('parseDocumentFacts returns empty facts for blank text', () => {
  const facts = parseDocumentFacts('   ');
  assert.deepEqual(facts.detectedDates, []);
  assert.equal(facts.suggestedExpiryDate, null);
  assert.deepEqual(facts.suggestedComplianceItems, []);
  assert.equal(facts.confidence, 0);
});

test('parseDocumentFacts splits Zambia unified road tax disc into multiple compliance rows', () => {
  const raw = `
    REPUBLIC OF ZAMBIA ROAD TAX and CES
    Reg Mark BAG94ZM
    Chassis Number: XAMTIS6677106FC
    Make: LAND ROVER
    This licence is valid until 02/09/2025
    Roadworthiness Expiry Date 03/03/2029
    Insurance Disc No. 645036
    Insurance Expiry Date 02/06/2025
    Date of issue: 02/06/2025
  `;
  const facts = parseDocumentFacts(raw, { category: 'registration' });
  assert.equal(facts.documentProfile, 'zambian_unified_disc');
  assert.equal(facts.suggestedComplianceItems.length, 3);

  const byType = Object.fromEntries(
    facts.suggestedComplianceItems.map((item) => [item.type, item.dueDate]),
  );
  assert.equal(byType.INSURANCE, '2025-06-02');
  assert.equal(byType.ROAD_TAX, '2025-09-02');
  assert.equal(byType.FITNESS, '2029-03-03');
});

test('parseDocumentFacts infers unified disc dates when labels are OCR-garbled', () => {
  const raw = `
    ROAD TAX and ces
    Chassis Number: XAMTIS6677106FC
    wae 02/09/2025
    03/03/2029
    Insurance Disc No. 645036
    Insurance Expiry Date 02/06/2025
    Date of issue: 02/06/2025
  `;
  const facts = parseDocumentFacts(raw);
  assert.equal(facts.documentProfile, 'zambian_unified_disc');
  const byType = Object.fromEntries(
    facts.suggestedComplianceItems.map((item) => [item.type, item.dueDate]),
  );
  assert.equal(byType.INSURANCE, '2025-06-02');
  assert.equal(byType.ROAD_TAX, '2025-09-02');
  assert.equal(byType.FITNESS, '2029-03-03');
});
