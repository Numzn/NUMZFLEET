import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { safeNotify } from './safeNotify.js';

describe('safeNotify', () => {
  it('calls fn with the given arguments and resolves when fn succeeds', async () => {
    const fn = mock.fn(async (a, b) => `${a}-${b}`);
    await safeNotify(fn, 'x', 'y');
    assert.equal(fn.mock.callCount(), 1);
    assert.deepEqual(fn.mock.calls[0].arguments, ['x', 'y']);
  });

  it('resolves without throwing when fn rejects — a failed side effect must not surface as the caller\'s failure', async () => {
    const fn = mock.fn(async () => {
      throw new Error('notification backend unavailable');
    });
    await assert.doesNotReject(async () => {
      await safeNotify(fn, { id: 'intent-1' }, { status: 'cancelled' });
    });
    assert.equal(fn.mock.callCount(), 1);
  });

  it('resolves without throwing when fn throws synchronously', async () => {
    const fn = mock.fn(() => {
      throw new Error('sync boom');
    });
    await assert.doesNotReject(async () => {
      await safeNotify(fn);
    });
  });
});
