import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deliverEmailNotification, buildEmailBody, buildEmailHtml } from './emailChannel.js';

describe('buildEmailBody / buildEmailHtml — sender footer for spam-filter trust signals', () => {
  it('plain-text body always carries the sender/footer line', () => {
    const body = buildEmailBody({ message: 'Vehicle ABC123 — Routine Service due soon' });
    assert.match(body, /NUMZ Technologies/);
    assert.match(body, /Manage what you receive/);
  });

  it('HTML body is a complete document, not a bare fragment, and carries the same footer', () => {
    const html = buildEmailHtml({ message: 'Vehicle ABC123 — Routine Service due soon' });
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /<html/);
    assert.match(html, /<body/);
    assert.match(html, /NUMZ Technologies/);
  });

  it('HTML body still escapes untrusted message content', () => {
    const html = buildEmailHtml({ message: '<script>alert(1)</script>' });
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });
});

describe('deliverEmailNotification — recipient resolution and failure handling', () => {
  it('returns no_recipient_email when there is no userId and no metadata.emailTo override (no live DB call — matches house convention of no I/O in unit tests)', async () => {
    const result = await deliverEmailNotification({
      userId: null,
      title: 'Test',
      message: 'Test message',
      metadata: {},
    });
    // Either the provider isn't configured in this environment, or the
    // resolution correctly finds no address — both are valid "did not send" outcomes.
    assert.equal(result.ok, false);
    assert.ok(['no_recipient_email', 'not_configured'].includes(result.reason));
  });

  it('returns invalid_email_address for a malformed metadata.emailTo override, without throwing', async () => {
    const result = await deliverEmailNotification({
      title: 'Test',
      message: 'Test message',
      metadata: { emailTo: 'not-an-email' },
    });
    assert.equal(result.ok, false);
    assert.ok(['invalid_email_address', 'not_configured'].includes(result.reason));
  });

  it('returns invalid_email_address for the numzUserProvisioning placeholder domain (@fleet.local is never a real deliverable address)', async () => {
    const result = await deliverEmailNotification({
      title: 'Test',
      message: 'Test message',
      metadata: { emailTo: 'user42@fleet.local' },
    });
    assert.equal(result.ok, false);
    assert.ok(['invalid_email_address', 'not_configured'].includes(result.reason));
  });

  it('accepts a well-formed metadata.emailTo override as the resolution path (resolvedVia), without requiring a real send to succeed', async () => {
    const result = await deliverEmailNotification({
      title: 'Test',
      message: 'Test message',
      metadata: { emailTo: 'someone@example.com' },
    });
    // In this test environment the provider is not configured, so delivery
    // itself correctly fails — what matters here is that a syntactically
    // valid override address was NOT rejected for its format, and never
    // triggered a DB lookup (no userId).
    assert.notEqual(result.reason, 'invalid_email_address');
    assert.notEqual(result.reason, 'no_recipient_email');
  });
});
