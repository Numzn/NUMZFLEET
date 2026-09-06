import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapRoutineStatusToType, routineTitleForType } from './maintenanceNotificationService.js';

describe('mapRoutineStatusToType', () => {
  it('on_track produces no notification type', () => {
    assert.equal(mapRoutineStatusToType('on_track', 900), null);
  });

  it('upcoming/due_soon/prepare/due_now map 1:1 to their own type, not a shared "due" bucket', () => {
    assert.equal(mapRoutineStatusToType('upcoming', 900), 'upcoming');
    assert.equal(mapRoutineStatusToType('due_soon', 400), 'due_soon');
    assert.equal(mapRoutineStatusToType('prepare', 50), 'prepare');
    assert.equal(mapRoutineStatusToType('due_now', 0), 'due_now');
  });

  it('overdue by less than 500km stays plain overdue', () => {
    assert.equal(mapRoutineStatusToType('overdue', -1), 'overdue');
    assert.equal(mapRoutineStatusToType('overdue', -499), 'overdue');
  });

  it('overdue by 500km or more escalates to critically_overdue', () => {
    assert.equal(mapRoutineStatusToType('overdue', -500), 'critically_overdue');
    assert.equal(mapRoutineStatusToType('overdue', -12000), 'critically_overdue');
  });

  it('overdue with a missing/non-finite remainingKm never escalates — a safe default, not a crash', () => {
    assert.equal(mapRoutineStatusToType('overdue', undefined), 'overdue');
    assert.equal(mapRoutineStatusToType('overdue', NaN), 'overdue');
    assert.equal(mapRoutineStatusToType('overdue', null), 'overdue');
  });

  it('an unrecognized status produces no notification type', () => {
    assert.equal(mapRoutineStatusToType('something_new', -9999), null);
  });
});

describe('routineTitleForType', () => {
  it('gives each tier its own, distinct title', () => {
    assert.equal(routineTitleForType('critically_overdue'), 'Routine Service critically overdue');
    assert.equal(routineTitleForType('overdue'), 'Routine Service overdue');
    assert.equal(routineTitleForType('due_now'), 'Routine Service due now');
    assert.equal(routineTitleForType('prepare'), 'Routine Service — prepare for service');
    assert.equal(routineTitleForType('due_soon'), 'Routine Service due soon');
    assert.equal(routineTitleForType('upcoming'), 'Routine Service upcoming');
  });

  it('legacy "due" (no live caller produces it anymore) still resolves, unchanged', () => {
    assert.equal(routineTitleForType('due'), 'Routine Service due soon');
  });
});
