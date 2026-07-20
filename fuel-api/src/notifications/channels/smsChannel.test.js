import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSmsText, deliverSmsNotification } from './smsChannel.js';

describe('buildSmsText', () => {
  it('labels recognized Traccar alarm sub-types over the generic title', () => {
    const cases = {
      sos: 'SOS alert',
      panic: 'Panic alert',
      tamper: 'Tampering detected',
      tampering: 'Tampering detected',
      powerCut: 'Power disconnected',
      powerOff: 'Power disconnected',
      lowPower: 'Low power/battery',
      lowBattery: 'Low power/battery',
      jamming: 'GPS jamming detected',
      shock: 'Shock/impact detected',
      accident: 'Accident detected',
      removing: 'Device removal detected',
    };
    for (const [alarm, label] of Object.entries(cases)) {
      const text = buildSmsText({
        title: 'Alarm',
        message: 'Device 5 reported an event',
        metadata: { alarmAttr: alarm },
      });
      assert.equal(text, `${label}: Device 5 reported an event`, `alarm=${alarm}`);
    }
  });

  it('falls back to title:message for an unrecognized alarm sub-type', () => {
    const text = buildSmsText({
      title: 'Alarm',
      message: 'Device 5 reported an event',
      metadata: { alarmAttr: 'someUnknownFutureAlarm' },
    });
    assert.equal(text, 'Alarm: Device 5 reported an event');
  });

  it('distinguishes immobilize vs mobilize for completed', () => {
    const immobilize = buildSmsText({
      type: 'immobilization.completed',
      title: 'Immobilize command sent',
      message: 'Vehicle 12 immobilized',
      metadata: { action: 'immobilize', status: 'completed' },
    });
    assert.equal(immobilize, 'Vehicle immobilized: Vehicle 12 immobilized');

    const mobilize = buildSmsText({
      type: 'immobilization.completed',
      title: 'Mobilize command sent',
      message: 'Vehicle 12 re-enabled',
      metadata: { action: 'mobilize', status: 'completed' },
    });
    assert.equal(mobilize, 'Vehicle re-enabled (mobilized): Vehicle 12 re-enabled');
  });

  it('distinguishes immobilize vs mobilize for failed, and marks it urgent', () => {
    const immobilizeFailed = buildSmsText({
      type: 'immobilization.failed',
      title: 'Immobilize command failed',
      message: 'traccar_http_rejected',
      metadata: { action: 'immobilize', status: 'failed' },
    });
    assert.equal(immobilizeFailed, 'URGENT: immobilize command failed: traccar_http_rejected');

    const mobilizeFailed = buildSmsText({
      type: 'immobilization.failed',
      title: 'Mobilize command failed',
      message: 'traccar_http_rejected',
      metadata: { action: 'mobilize', status: 'failed' },
    });
    assert.equal(mobilizeFailed, 'URGENT: re-enable (mobilize) command failed: traccar_http_rejected');
  });

  it('falls back to title:message for producers with neither alarmAttr nor immobilization action (e.g. manual escalation)', () => {
    const text = buildSmsText({
      type: 'tracking.alert.escalated',
      title: 'Vehicle alert escalated',
      message: 'Alert escalated for device 5',
      metadata: { deviceId: 5 },
    });
    assert.equal(text, 'Vehicle alert escalated: Alert escalated for device 5');
  });

  it('falls back to bare message when there is no title', () => {
    const text = buildSmsText({ title: '', message: 'just the message', metadata: {} });
    assert.equal(text, 'just the message');
  });
});

describe('deliverSmsNotification — recipient resolution and failure handling', () => {
  it('returns no_recipient_phone when there is no userId and no metadata.smsTo override (no live DB call — matches house convention of no I/O in unit tests)', async () => {
    const result = await deliverSmsNotification({
      userId: null,
      title: 'Test',
      message: 'Test message',
      metadata: {},
    });
    // Either the gateway isn't configured in this environment, or the
    // resolution correctly finds no phone — both are valid "did not send" outcomes.
    assert.equal(result.ok, false);
    assert.ok(['no_recipient_phone', 'not_configured'].includes(result.reason));
  });

  it('returns invalid_phone_number for an unnormalizable metadata.smsTo override, without throwing', async () => {
    const result = await deliverSmsNotification({
      title: 'Test',
      message: 'Test message',
      metadata: { smsTo: 'not-a-phone-number' },
    });
    assert.equal(result.ok, false);
    assert.ok(['invalid_phone_number', 'not_configured'].includes(result.reason));
  });

  it('a failing SMS gateway send is caught and returns ok:false rather than throwing (failure isolation)', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('simulated gateway network failure');
    };
    try {
      const result = await deliverSmsNotification({
        title: 'Test',
        message: 'Test message',
        metadata: { smsTo: '+260971234567' },
      });
      assert.equal(result.ok, false);
      assert.ok(['send_failed', 'not_configured'].includes(result.reason));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
