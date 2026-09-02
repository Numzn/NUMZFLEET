import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';

const REQUIRED_ENV = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];

function withEnv(vars, fn) {
  const saved = {};
  for (const key of REQUIRED_ENV) saved[key] = process.env[key];
  Object.assign(process.env, vars);
  return fn().finally(() => {
    for (const key of REQUIRED_ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
}

// webPushProvider.js reads env vars once at module load into module-scoped
// consts (same pattern as emailProvider.js) — force a fresh module instance
// per test via a cache-busting query string rather than relying on Node's
// ES module cache.
async function freshProvider() {
  return import(`./webPushProvider.js?t=${Date.now()}-${Math.random()}`);
}

const SUBSCRIPTION = { endpoint: 'https://push.example.com/abc', p256dh: 'p256dh-key', auth: 'auth-key' };

describe('isWebPushConfigured', () => {
  it('is false when required env vars are unset', async () => {
    await withEnv({ VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: '' }, async () => {
      const { isWebPushConfigured } = await freshProvider();
      assert.equal(isWebPushConfigured(), false);
    });
  });

  it('is true once public key, private key, and subject are all set', async () => {
    await withEnv({
      // Real, correctly-generated VAPID keypair (not a live/secret one — this
      // is dev-only test fixture data) — web-push validates key format/length
      // even when sendNotification itself is mocked, so a lazy placeholder
      // string fails validation before the mock is ever reached.
      VAPID_PUBLIC_KEY: 'BNCjv14jmHW9Cd_FE5uHHxf92N_30MXJEBo7HoDNCSvtyjXSYZPBjwnm_FIvZlhPvMG_RsyjakuzJcb3HI6RsoE',
      VAPID_PRIVATE_KEY: 'EBGGohvzX6ZfCdFofVwonosZ11h106lYX_Mp4l0o8W8',
      VAPID_SUBJECT: 'mailto:test@example.com',
    }, async () => {
      const { isWebPushConfigured } = await freshProvider();
      assert.equal(isWebPushConfigured(), true);
    });
  });
});

describe('sendWebPush — not configured (no I/O)', () => {
  it('rejects with a 503 before touching the transport', async () => {
    await withEnv({ VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: '' }, async () => {
      const { sendWebPush } = await freshProvider();
      await assert.rejects(
        () => sendWebPush(SUBSCRIPTION, { title: 'Test', body: 'Body' }),
        (err) => err.statusCode === 503,
      );
    });
  });
});

describe('sendWebPush — transport interaction (mocked, no real network I/O)', () => {
  const configuredEnv = {
    VAPID_PUBLIC_KEY: 'BNCjv14jmHW9Cd_FE5uHHxf92N_30MXJEBo7HoDNCSvtyjXSYZPBjwnm_FIvZlhPvMG_RsyjakuzJcb3HI6RsoE',
    VAPID_PRIVATE_KEY: 'EBGGohvzX6ZfCdFofVwonosZ11h106lYX_Mp4l0o8W8',
    VAPID_SUBJECT: 'mailto:test@example.com',
  };

  it('returns ok:true on a successful send', async () => {
    await withEnv(configuredEnv, async () => {
      const sendMock = mock.method(webpush, 'sendNotification', async () => ({ statusCode: 201 }));
      try {
        const { sendWebPush } = await freshProvider();
        const result = await sendWebPush(SUBSCRIPTION, { title: 'Test', body: 'Body' });
        assert.equal(result.ok, true);
        assert.equal(sendMock.mock.callCount(), 1);
      } finally {
        sendMock.mock.restore();
      }
    });
  });

  it('marks a 410 Gone as expired — the standard RFC 8030 signal a subscription is dead', async () => {
    await withEnv(configuredEnv, async () => {
      const sendMock = mock.method(webpush, 'sendNotification', async () => {
        const error = new Error('gone');
        error.statusCode = 410;
        throw error;
      });
      try {
        const { sendWebPush } = await freshProvider();
        await assert.rejects(
          () => sendWebPush(SUBSCRIPTION, { title: 'Test', body: 'Body' }),
          (err) => err.expired === true && err.statusCode === 410,
        );
      } finally {
        sendMock.mock.restore();
      }
    });
  });

  it('marks a 404 Not Found as expired too', async () => {
    await withEnv(configuredEnv, async () => {
      const sendMock = mock.method(webpush, 'sendNotification', async () => {
        const error = new Error('not found');
        error.statusCode = 404;
        throw error;
      });
      try {
        const { sendWebPush } = await freshProvider();
        await assert.rejects(
          () => sendWebPush(SUBSCRIPTION, { title: 'Test', body: 'Body' }),
          (err) => err.expired === true,
        );
      } finally {
        sendMock.mock.restore();
      }
    });
  });

  it('a transient failure (e.g. 500) is NOT marked expired — do not delete a subscription for a retryable error', async () => {
    await withEnv(configuredEnv, async () => {
      const sendMock = mock.method(webpush, 'sendNotification', async () => {
        const error = new Error('upstream error');
        error.statusCode = 500;
        throw error;
      });
      try {
        const { sendWebPush } = await freshProvider();
        await assert.rejects(
          () => sendWebPush(SUBSCRIPTION, { title: 'Test', body: 'Body' }),
          (err) => err.expired === false || err.expired === undefined,
        );
      } finally {
        sendMock.mock.restore();
      }
    });
  });
});
