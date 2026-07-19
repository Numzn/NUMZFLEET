import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  severityForStatus,
  titleForIntent,
  PUBLISH_STATUS,
} from './immobilizationNotificationService.js';

describe('severityForStatus', () => {
  it('maps expired to warning', () => {
    assert.equal(severityForStatus('expired'), 'warning');
  });

  it('maps failed to critical', () => {
    assert.equal(severityForStatus('failed'), 'critical');
  });

  it('maps completed to success', () => {
    assert.equal(severityForStatus('completed'), 'success');
  });
});

describe('titleForIntent', () => {
  it('produces a distinct expiry title, not an error-sounding one', () => {
    const title = titleForIntent({ action: 'immobilize' }, 'expired');
    assert.equal(title, 'Immobilize request expired');
    assert.doesNotMatch(title, /fail/i);
  });

  it('handles the mobilize action variant', () => {
    assert.equal(titleForIntent({ action: 'mobilize' }, 'expired'), 'Mobilize request expired');
  });
});

describe('PUBLISH_STATUS', () => {
  it('now includes expired, so expired transitions get a persisted notification', () => {
    assert.ok(PUBLISH_STATUS.includes('expired'));
  });

  it('still includes the pre-existing statuses', () => {
    for (const s of ['completed', 'failed', 'blocked', 'cancelled']) {
      assert.ok(PUBLISH_STATUS.includes(s), `expected PUBLISH_STATUS to include ${s}`);
    }
  });
});

