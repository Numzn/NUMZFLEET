import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { commandResultLooksLikeAck } from './deviceCommandOutcomeProbe.js';

describe('commandResultLooksLikeAck', () => {
  it('accepts commandResult with empty result', () => {
    assert.equal(commandResultLooksLikeAck({ type: 'commandResult', attributes: {} }, 'engineStop'), true);
  });

  it('rejects explicit failure text', () => {
    assert.equal(
      commandResultLooksLikeAck(
        { type: 'commandResult', attributes: { result: 'Command failed' } },
        'engineStop',
      ),
      false,
    );
  });

  it('accepts engineStop ok-style result', () => {
    assert.equal(
      commandResultLooksLikeAck(
        { type: 'commandResult', attributes: { result: 'STOP OK' } },
        'engineStop',
      ),
      true,
    );
  });

  it('ignores non-commandResult events', () => {
    assert.equal(commandResultLooksLikeAck({ type: 'deviceOnline', attributes: {} }), false);
  });
});
