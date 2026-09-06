import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { requireSmsGatewayWebhookSecret } from './smsGatewayWebhookAuth.js';

const ORIGINAL = process.env.SMS_GATEWAY_WEBHOOK_SECRET;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SMS_GATEWAY_WEBHOOK_SECRET;
  else process.env.SMS_GATEWAY_WEBHOOK_SECRET = ORIGINAL;
});

function mockReqRes(headerValue) {
  const req = { get: (name) => (name.toLowerCase() === 'x-sms-gateway-webhook-secret' ? headerValue : undefined) };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  return { req, res };
}

describe('requireSmsGatewayWebhookSecret', () => {
  it('fails closed with 503 when unconfigured, rather than accepting anything', () => {
    delete process.env.SMS_GATEWAY_WEBHOOK_SECRET;
    const { req, res } = mockReqRes('anything');
    let nextCalled = false;
    requireSmsGatewayWebhookSecret(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
  });

  it('rejects a missing header with 401', () => {
    process.env.SMS_GATEWAY_WEBHOOK_SECRET = 'real-secret';
    const { req, res } = mockReqRes(undefined);
    let nextCalled = false;
    requireSmsGatewayWebhookSecret(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it('rejects a wrong secret with 401', () => {
    process.env.SMS_GATEWAY_WEBHOOK_SECRET = 'real-secret';
    const { req, res } = mockReqRes('wrong-secret');
    let nextCalled = false;
    requireSmsGatewayWebhookSecret(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it('calls next() for the correct secret', () => {
    process.env.SMS_GATEWAY_WEBHOOK_SECRET = 'real-secret';
    const { req, res } = mockReqRes('real-secret');
    let nextCalled = false;
    requireSmsGatewayWebhookSecret(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null, 'must not have written a response when passing through');
  });
});
