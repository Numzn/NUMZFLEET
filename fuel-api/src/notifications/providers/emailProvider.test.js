import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

const REQUIRED_ENV = ['EMAIL_PROVIDER', 'EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'];

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

// emailProvider.js reads env vars once at module load into module-scoped
// consts, so tests that need a specific configured/unconfigured state must
// re-import the module fresh under that env — a dynamic import with a
// cache-busting query string forces a new module instance instead of
// reusing Node's ES module cache.
async function freshProvider() {
  return import(`./emailProvider.js?t=${Date.now()}-${Math.random()}`);
}

describe('isEmailConfigured', () => {
  it('is false when required env vars are unset', async () => {
    await withEnv({
      EMAIL_PROVIDER: '', EMAIL_HOST: '', EMAIL_USER: '', EMAIL_PASSWORD: '', EMAIL_FROM: '',
    }, async () => {
      const { isEmailConfigured } = await freshProvider();
      assert.equal(isEmailConfigured(), false);
    });
  });

  it('is true once provider, host, user, password, and from are all set', async () => {
    await withEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_USER: 'alerts@example.com',
      EMAIL_PASSWORD: 'app-password',
      EMAIL_FROM: 'alerts@example.com',
    }, async () => {
      const { isEmailConfigured } = await freshProvider();
      assert.equal(isEmailConfigured(), true);
    });
  });
});

describe('sendEmail — input validation (no I/O)', () => {
  it('rejects a missing recipient before touching any transport', async () => {
    const { sendEmail } = await freshProvider();
    await assert.rejects(
      () => sendEmail({ to: '', subject: 'Test', text: 'Body' }),
      /recipient/i,
    );
  });

  it('rejects a missing subject before touching any transport', async () => {
    const { sendEmail } = await freshProvider();
    await assert.rejects(
      () => sendEmail({ to: 'user@example.com', subject: '', text: 'Body' }),
      /subject/i,
    );
  });

  it('rejects with a 503 when not configured, before touching any transport', async () => {
    await withEnv({
      EMAIL_PROVIDER: '', EMAIL_HOST: '', EMAIL_USER: '', EMAIL_PASSWORD: '', EMAIL_FROM: '',
    }, async () => {
      const { sendEmail } = await freshProvider();
      await assert.rejects(
        () => sendEmail({ to: 'user@example.com', subject: 'Test', text: 'Body' }),
        (err) => err.statusCode === 503,
      );
    });
  });
});

describe('sendEmail — transport interaction (mocked, no real network I/O)', () => {
  it('returns ok:true with the transport-provided message id on success', async () => {
    await withEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_USER: 'alerts@example.com',
      EMAIL_PASSWORD: 'app-password',
      EMAIL_FROM: 'alerts@example.com',
    }, async () => {
      const createTransportMock = mock.method(nodemailer, 'createTransport', () => ({
        sendMail: async () => ({ messageId: '<abc123@example.com>' }),
      }));
      try {
        const { sendEmail } = await freshProvider();
        const result = await sendEmail({ to: 'user@example.com', subject: 'Test', text: 'Body' });
        assert.equal(result.ok, true);
        assert.equal(result.id, '<abc123@example.com>');
      } finally {
        createTransportMock.mock.restore();
      }
    });
  });

  it('EMAIL_FROM_NAME unset -> from is the plain address, unchanged from before this option existed', async () => {
    await withEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_USER: 'alerts@example.com',
      EMAIL_PASSWORD: 'app-password',
      EMAIL_FROM: 'alerts@example.com',
    }, async () => {
      delete process.env.EMAIL_FROM_NAME;
      let capturedArgs;
      const createTransportMock = mock.method(nodemailer, 'createTransport', () => ({
        sendMail: async (args) => { capturedArgs = args; return { messageId: '<x@example.com>' }; },
      }));
      try {
        const { sendEmail } = await freshProvider();
        await sendEmail({ to: 'user@example.com', subject: 'Test', text: 'Body' });
        assert.equal(capturedArgs.from, 'alerts@example.com');
      } finally {
        createTransportMock.mock.restore();
      }
    });
  });

  it('EMAIL_FROM_NAME set -> from is a {name, address} object, not a string', async () => {
    await withEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_USER: 'alerts@example.com',
      EMAIL_PASSWORD: 'app-password',
      EMAIL_FROM: 'alerts@example.com',
    }, async () => {
      process.env.EMAIL_FROM_NAME = 'NUMZ TECHNOLOGIES';
      let capturedArgs;
      const createTransportMock = mock.method(nodemailer, 'createTransport', () => ({
        sendMail: async (args) => { capturedArgs = args; return { messageId: '<x@example.com>' }; },
      }));
      try {
        const { sendEmail } = await freshProvider();
        await sendEmail({ to: 'user@example.com', subject: 'Test', text: 'Body' });
        assert.deepEqual(capturedArgs.from, { name: 'NUMZ TECHNOLOGIES', address: 'alerts@example.com' });
      } finally {
        createTransportMock.mock.restore();
        delete process.env.EMAIL_FROM_NAME;
      }
    });
  });

  it('always sets a List-Unsubscribe header — its absence is itself a spam signal for automated mail', async () => {
    await withEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_USER: 'alerts@example.com',
      EMAIL_PASSWORD: 'app-password',
      EMAIL_FROM: 'alerts@example.com',
    }, async () => {
      let capturedArgs;
      const createTransportMock = mock.method(nodemailer, 'createTransport', () => ({
        sendMail: async (args) => { capturedArgs = args; return { messageId: '<x@example.com>' }; },
      }));
      try {
        const { sendEmail } = await freshProvider();
        await sendEmail({ to: 'user@example.com', subject: 'Test', text: 'Body' });
        assert.equal(capturedArgs.headers['List-Unsubscribe'], '<mailto:alerts@example.com?subject=unsubscribe>');
      } finally {
        createTransportMock.mock.restore();
      }
    });
  });

  it('a transport failure is caught and rethrown as a clean error, not left as a raw network exception', async () => {
    await withEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_USER: 'alerts@example.com',
      EMAIL_PASSWORD: 'app-password',
      EMAIL_FROM: 'alerts@example.com',
    }, async () => {
      const createTransportMock = mock.method(nodemailer, 'createTransport', () => ({
        sendMail: async () => {
          throw new Error('simulated SMTP connection refused');
        },
      }));
      try {
        const { sendEmail } = await freshProvider();
        await assert.rejects(
          () => sendEmail({ to: 'user@example.com', subject: 'Test', text: 'Body' }),
          (err) => typeof err.statusCode === 'number' && !/EMAIL_PASSWORD|app-password/.test(err.message),
        );
      } finally {
        createTransportMock.mock.restore();
      }
    });
  });

  it('a transport that never resolves is bounded by EMAIL_TIMEOUT_MS, not left hanging', async () => {
    await withEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_USER: 'alerts@example.com',
      EMAIL_PASSWORD: 'app-password',
      EMAIL_FROM: 'alerts@example.com',
      EMAIL_TIMEOUT_MS: '50',
    }, async () => {
      const createTransportMock = mock.method(nodemailer, 'createTransport', () => ({
        sendMail: () => new Promise(() => {}), // never resolves
      }));
      try {
        const { sendEmail } = await freshProvider();
        await assert.rejects(
          () => sendEmail({ to: 'user@example.com', subject: 'Test', text: 'Body' }),
          (err) => err.statusCode === 504,
        );
      } finally {
        createTransportMock.mock.restore();
      }
    });
  });
});
