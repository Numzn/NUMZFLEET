import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nonRoutineRiskCounts } from './maintenanceNotificationScheduler.js';

function schedule({ bucket = null, routine = false } = {}) {
  return {
    bucket,
    attributes: routine ? { numzServicePackage: true } : {},
  };
}

describe('nonRoutineRiskCounts', () => {
  it('empty/no items -> zero counts, not an error', () => {
    assert.deepEqual(nonRoutineRiskCounts([]), { overdueCount: 0, dueSoonCount: 0 });
    assert.deepEqual(nonRoutineRiskCounts(undefined ?? []), { overdueCount: 0, dueSoonCount: 0 });
  });

  it('excludes the routine-service-tagged schedule entirely, even when overdue', () => {
    const items = [schedule({ bucket: 'overdue', routine: true })];
    assert.deepEqual(nonRoutineRiskCounts(items), { overdueCount: 0, dueSoonCount: 0 });
  });

  it('counts a non-routine overdue schedule', () => {
    const items = [schedule({ bucket: 'overdue' })];
    assert.deepEqual(nonRoutineRiskCounts(items), { overdueCount: 1, dueSoonCount: 0 });
  });

  it('dueToday/dueThisWeek/dueSoon buckets all count toward dueSoonCount', () => {
    const items = [
      schedule({ bucket: 'dueToday' }),
      schedule({ bucket: 'dueThisWeek' }),
      schedule({ bucket: 'dueSoon' }),
    ];
    assert.deepEqual(nonRoutineRiskCounts(items), { overdueCount: 0, dueSoonCount: 3 });
  });

  it('"scheduled" and null buckets count toward neither', () => {
    const items = [schedule({ bucket: 'scheduled' }), schedule({ bucket: null })];
    assert.deepEqual(nonRoutineRiskCounts(items), { overdueCount: 0, dueSoonCount: 0 });
  });

  it('mixed fleet: routine excluded, non-routine overdue and due-soon both counted independently', () => {
    const items = [
      schedule({ bucket: 'overdue', routine: true }),
      schedule({ bucket: 'overdue' }),
      schedule({ bucket: 'overdue' }),
      schedule({ bucket: 'dueSoon' }),
    ];
    assert.deepEqual(nonRoutineRiskCounts(items), { overdueCount: 2, dueSoonCount: 1 });
  });
});
