import test from 'node:test';
import assert from 'node:assert/strict';

import { TRACKER_COUNTER_LABEL, positionRowLabel } from './statusCardLabels.js';

test('a tracker distance counter is never labelled like the vehicle\'s odometer', () => {
  assert.equal(positionRowLabel('totalDistance', 'Total Distance'), TRACKER_COUNTER_LABEL);
  assert.equal(positionRowLabel('odometer', 'Odometer'), TRACKER_COUNTER_LABEL);
});

test('every other attribute keeps its own localized name, or its key as a last resort', () => {
  assert.equal(positionRowLabel('speed', 'Speed'), 'Speed');
  assert.equal(positionRowLabel('fixTime', undefined), 'fixTime');
  assert.equal(positionRowLabel('distance', 'Distance'), 'Distance');
});
