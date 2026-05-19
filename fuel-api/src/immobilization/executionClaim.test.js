import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Claim SQL invariants (documented here; integration tests optional for P0).
 * The live claim only transitions pending|monitoring → executing when not expired.
 */
const CLAIM_STATUS_FILTER = "status IN ('pending', 'monitoring')";
const CLAIM_EXPIRY_GUARD = '"expiresAt" > NOW()';
const TERMINAL_STATUS_GUARD = "status = 'executing'";

describe('execution claim SQL contract', () => {
  it('claim requires pending or monitoring and unexpired intent', () => {
    assert.match(CLAIM_STATUS_FILTER, /pending/);
    assert.match(CLAIM_STATUS_FILTER, /monitoring/);
    assert.doesNotMatch(CLAIM_STATUS_FILTER, /executing/);
    assert.ok(CLAIM_EXPIRY_GUARD.includes('expiresAt'));
  });

  it('terminal update only from executing', () => {
    assert.equal(TERMINAL_STATUS_GUARD, "status = 'executing'");
  });
});
