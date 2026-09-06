import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseWebhookPayload, parseStatusResponse, PROVIDER } from './smsGatewayAdapter.js';
import { DELIVERY_STATUS } from '../deliveryStates.js';

// Fixtures below match the gateway's own documented shapes exactly
// (https://docs.sms-gate.app/features/webhooks/) and the real response
// captured live from the configured gateway this session.

describe('smsGatewayAdapter.parseWebhookPayload', () => {
  it('sms:sent maps to SENT with the sentAt timestamp', () => {
    const result = parseWebhookPayload({
      deviceId: 'ffffffffceb0b1db0000018e937c815b',
      event: 'sms:sent',
      id: 'Ey6ECgOkVVFjz3CL48B8C',
      payload: {
        messageId: 'msg-456', sender: '+1234567890', recipient: '+9998887777', simNumber: 1, partsCount: 1, sentAt: '2026-02-18T02:05:00.000+07:00',
      },
      webhookId: 'LreFUt-Z3sSq0JufY9uWB',
    });
    assert.equal(result.ok, true);
    assert.equal(result.event.provider, PROVIDER);
    assert.equal(result.event.providerMessageId, 'msg-456');
    assert.equal(result.event.status, DELIVERY_STATUS.SENT);
    assert.equal(result.event.failureCode, null);
    assert.equal(result.event.occurredAt.toISOString(), new Date('2026-02-18T02:05:00.000+07:00').toISOString());
  });

  it('sms:delivered maps to DELIVERED', () => {
    const result = parseWebhookPayload({
      event: 'sms:delivered',
      payload: { messageId: 'msg-789', deliveredAt: '2026-02-18T02:10:00.000+07:00' },
    });
    assert.equal(result.ok, true);
    assert.equal(result.event.status, DELIVERY_STATUS.DELIVERED);
    assert.equal(result.event.providerMessageId, 'msg-789');
  });

  it('sms:failed maps to FAILED with the provider reason preserved, under our own failure code', () => {
    const result = parseWebhookPayload({
      event: 'sms:failed',
      payload: {
        messageId: 'msg-000', failedAt: '2026-02-18T02:15:00.000+07:00', reason: 'Network error',
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.event.status, DELIVERY_STATUS.FAILED);
    assert.equal(result.event.failureCode, 'provider_failed');
    assert.equal(result.event.failureReason, 'Network error');
  });

  it('sms:cancelled maps to FAILED, not our own CANCELLED (that means something different in our vocabulary)', () => {
    const result = parseWebhookPayload({
      event: 'sms:cancelled',
      payload: { messageId: 'msg-456', cancelledAt: '2026-06-22T10:00:00.000+07:00' },
    });
    assert.equal(result.ok, true);
    assert.equal(result.event.status, DELIVERY_STATUS.FAILED);
    assert.equal(result.event.failureCode, 'provider_cancelled');
  });

  it('an unknown/unhandled event (e.g. inbound sms:received) is reported, not thrown', () => {
    const result = parseWebhookPayload({ event: 'sms:received', payload: { messageId: 'x' } });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unknown_event');
  });

  it('a malformed body does not throw', () => {
    assert.equal(parseWebhookPayload(null).ok, false);
    assert.equal(parseWebhookPayload('not an object').ok, false);
    assert.equal(parseWebhookPayload(42).ok, false);
  });

  it('a missing event field is rejected safely', () => {
    const result = parseWebhookPayload({ payload: { messageId: 'x' } });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_event');
  });

  it('a missing messageId is rejected safely', () => {
    const result = parseWebhookPayload({ event: 'sms:delivered', payload: {} });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_message_id');
  });
});

describe('smsGatewayAdapter.parseStatusResponse', () => {
  it('Delivered maps to DELIVERED, using the real captured response shape', () => {
    // Shape captured live from the configured gateway this session.
    const real = {
      id: 'bDhGcIAP90BiKAU2aADsH',
      deviceId: 'evdBxz75Y_ob-WiBesDJw',
      state: 'Delivered',
      isHashed: true,
      isEncrypted: false,
      recipients: [{ phoneNumber: 'ffdf7d2d1ed9ee4c', state: 'Delivered' }],
      states: {
        Pending: '2026-09-03T12:12:53.398Z',
        Processed: '2026-09-03T12:12:53.543Z',
        Sent: '2026-09-03T12:12:54.012Z',
        Delivered: '2026-09-03T12:12:58.308Z',
      },
    };
    const result = parseStatusResponse('bDhGcIAP90BiKAU2aADsH', real);
    assert.equal(result.ok, true);
    assert.equal(result.event.status, DELIVERY_STATUS.DELIVERED);
    assert.equal(result.event.providerMessageId, 'bDhGcIAP90BiKAU2aADsH');
    assert.equal(result.event.occurredAt.toISOString(), '2026-09-03T12:12:58.308Z');
  });

  it('Sent (not yet delivered) maps to SENT', () => {
    const real = {
      id: 'cQPR4SP7gxfBTQdugpzHe',
      state: 'Sent',
      recipients: [{ phoneNumber: '689e3eed411720eb', state: 'Sent' }],
      states: { Pending: '2026-09-05T14:48:25.1Z', Processed: '2026-09-05T14:48:25.342Z', Sent: '2026-09-05T14:48:25.985Z' },
    };
    const result = parseStatusResponse('cQPR4SP7gxfBTQdugpzHe', real);
    assert.equal(result.ok, true);
    assert.equal(result.event.status, DELIVERY_STATUS.SENT);
  });

  it('Pending/Processed are reported as still in flight, not a status change', () => {
    assert.equal(parseStatusResponse('x', { state: 'Pending' }).reason, 'still_in_flight');
    assert.equal(parseStatusResponse('x', { state: 'Processed' }).reason, 'still_in_flight');
  });

  it('Failed maps to FAILED with the per-recipient error surfaced', () => {
    const result = parseStatusResponse('x', {
      state: 'Failed',
      recipients: [{ phoneNumber: 'abc', state: 'Failed', error: 'invalid destination' }],
      states: { Failed: '2026-09-05T00:00:00.000Z' },
    });
    assert.equal(result.ok, true);
    assert.equal(result.event.status, DELIVERY_STATUS.FAILED);
    assert.equal(result.event.failureCode, 'provider_failed');
    assert.equal(result.event.failureReason, 'invalid destination');
  });

  it('a malformed response does not throw', () => {
    assert.equal(parseStatusResponse('x', null).ok, false);
    assert.equal(parseStatusResponse('x', {}).ok, false);
  });
});
