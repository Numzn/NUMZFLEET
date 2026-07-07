import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILL_CLASSIFICATION,
  normalizeFillClassification,
  resolveFillClassificationFromPayload,
  assertPhysicalCapacitySanity,
  isConfirmedFull,
  isConfirmedPartial,
  isUnknownFill,
  toLegacyIsFullTank,
  getAnchorClassificationSource,
  resolveReplayFillKind,
  ANCHOR_CLASSIFICATION_SOURCE,
} from './fuelFillClassification.js';

test('normalizeFillClassification accepts FULL, PARTIAL, UNKNOWN', () => {
  assert.equal(normalizeFillClassification('FULL'), FILL_CLASSIFICATION.FULL);
  assert.equal(normalizeFillClassification('partial'), FILL_CLASSIFICATION.PARTIAL);
  assert.equal(normalizeFillClassification('unknown'), FILL_CLASSIFICATION.UNKNOWN);
  assert.equal(normalizeFillClassification(null), FILL_CLASSIFICATION.UNKNOWN);
  assert.equal(normalizeFillClassification(''), FILL_CLASSIFICATION.UNKNOWN);
});

test('normalizeFillClassification rejects unsupported values', () => {
  assert.equal(normalizeFillClassification('MAYBE'), null);
  assert.equal(normalizeFillClassification(true), null);
});

test('resolveFillClassificationFromPayload prefers explicit fillClassification', () => {
  const result = resolveFillClassificationFromPayload({ fillClassification: 'PARTIAL' });
  assert.equal(result.classification, FILL_CLASSIFICATION.PARTIAL);
  assert.equal(result.source, 'explicit');
});

test('resolveFillClassificationFromPayload rejects invalid fillClassification', () => {
  assert.throws(
    () => resolveFillClassificationFromPayload({ fillClassification: 'MAYBE' }),
    (err) => err.statusCode === 400,
  );
});

test('resolveFillClassificationFromPayload requires classification when absent', () => {
  assert.throws(
    () => resolveFillClassificationFromPayload({ actualFuelLitres: 50 }),
    (err) => err.statusCode === 400,
  );
});

test('legacy explicit isFullTank true maps to FULL', () => {
  const result = resolveFillClassificationFromPayload({ isFullTank: true });
  assert.equal(result.classification, FILL_CLASSIFICATION.FULL);
  assert.equal(result.source, 'legacy_isFullTank');
});

test('legacy explicit isFullTank false maps to UNKNOWN not PARTIAL', () => {
  const result = resolveFillClassificationFromPayload({ isFullTank: false });
  assert.equal(result.classification, FILL_CLASSIFICATION.UNKNOWN);
  assert.equal(result.source, 'legacy_isFullTank');
});

test('toLegacyIsFullTank mapping', () => {
  assert.equal(toLegacyIsFullTank(FILL_CLASSIFICATION.FULL), true);
  assert.equal(toLegacyIsFullTank(FILL_CLASSIFICATION.PARTIAL), false);
  assert.equal(toLegacyIsFullTank(FILL_CLASSIFICATION.UNKNOWN), false);
});

test('isConfirmedFull accepts explicit FULL', () => {
  assert.equal(isConfirmedFull({ fillClassification: 'FULL', isFullTank: true }), true);
});

test('isConfirmedFull accepts legacy isFullTank true with UNKNOWN classification', () => {
  assert.equal(isConfirmedFull({ fillClassification: 'UNKNOWN', isFullTank: true }), true);
});

test('isConfirmedFull rejects legacy false and UNKNOWN', () => {
  assert.equal(isConfirmedFull({ fillClassification: 'UNKNOWN', isFullTank: false }), false);
  assert.equal(isConfirmedFull({ fillClassification: 'PARTIAL', isFullTank: false }), false);
});

test('isConfirmedPartial requires explicit PARTIAL', () => {
  assert.equal(isConfirmedPartial({ fillClassification: 'PARTIAL' }), true);
  assert.equal(isConfirmedPartial({ fillClassification: 'UNKNOWN', isFullTank: false }), false);
});

test('isUnknownFill treats legacy false as unknown not partial', () => {
  assert.equal(isUnknownFill({ fillClassification: 'UNKNOWN', isFullTank: false }), true);
  assert.equal(isConfirmedPartial({ fillClassification: 'UNKNOWN', isFullTank: false }), false);
});

test('getAnchorClassificationSource provenance', () => {
  assert.equal(
    getAnchorClassificationSource({ fillClassification: 'FULL', isFullTank: true }),
    ANCHOR_CLASSIFICATION_SOURCE.EXPLICIT_CLASSIFICATION,
  );
  assert.equal(
    getAnchorClassificationSource({ fillClassification: 'UNKNOWN', isFullTank: true }),
    ANCHOR_CLASSIFICATION_SOURCE.LEGACY_CONFIRMED_FULL,
  );
  assert.equal(getAnchorClassificationSource({ fillClassification: 'UNKNOWN', isFullTank: false }), null);
});

test('resolveReplayFillKind', () => {
  assert.equal(resolveReplayFillKind({ fillClassification: 'FULL' }), 'full');
  assert.equal(resolveReplayFillKind({ fillClassification: 'PARTIAL' }), 'partial');
  assert.equal(resolveReplayFillKind({ fillClassification: 'UNKNOWN', isFullTank: false }), 'unknown');
  assert.equal(resolveReplayFillKind({ fillClassification: 'UNKNOWN', isFullTank: true }), 'full');
});

test('no silent default to FULL or PARTIAL in payload resolution', () => {
  assert.throws(() => resolveFillClassificationFromPayload({}));
  assert.throws(() => resolveFillClassificationFromPayload({ actualFuelLitres: 40, mileage: 1000 }));
});

test('assertPhysicalCapacitySanity rejects FULL exceeding a verified capacity', () => {
  assert.throws(
    () => assertPhysicalCapacitySanity({
      actualFuelLitres: 120,
      tankCapacitySnapshot: 60,
      capacityVerified: true,
    }),
    /exceeds the verified tank capacity/,
  );
});

test('assertPhysicalCapacitySanity rejects PARTIAL exceeding a verified capacity (no exemption)', () => {
  assert.throws(() => assertPhysicalCapacitySanity({
    actualFuelLitres: 120,
    tankCapacitySnapshot: 60,
    capacityVerified: true,
  }));
});

test('assertPhysicalCapacitySanity rejects UNKNOWN exceeding a verified capacity — no bypass', () => {
  assert.throws(() => assertPhysicalCapacitySanity({
    actualFuelLitres: 120,
    tankCapacitySnapshot: 60,
    capacityVerified: true,
  }));
});

test('assertPhysicalCapacitySanity does not reject when capacity is unverified/default', () => {
  assert.doesNotThrow(() => assertPhysicalCapacitySanity({
    actualFuelLitres: 120,
    tankCapacitySnapshot: 60,
    capacityVerified: false,
  }));
});

test('assertPhysicalCapacitySanity allows litres within a verified capacity', () => {
  assert.doesNotThrow(() => assertPhysicalCapacitySanity({
    actualFuelLitres: 55,
    tankCapacitySnapshot: 60,
    capacityVerified: true,
  }));
});

test('assertPhysicalCapacitySanity is a no-op with no usable capacity snapshot', () => {
  assert.doesNotThrow(() => assertPhysicalCapacitySanity({
    actualFuelLitres: 120,
    tankCapacitySnapshot: null,
    capacityVerified: true,
  }));
});
