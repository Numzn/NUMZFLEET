import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  isTimeoutError,
  getTraccarApiTimeoutMs,
  sendDeviceCommand,
  fetchCommandTypes,
} from './traccarCommandService.js';
import { getClaimTimeoutSec } from '../immobilization/executionRecovery.js';

describe('isTimeoutError', () => {
  it('matches AbortSignal.timeout()\'s TimeoutError', () => {
    assert.equal(isTimeoutError({ name: 'TimeoutError' }), true);
  });

  it('matches a manually-aborted AbortError', () => {
    assert.equal(isTimeoutError({ name: 'AbortError' }), true);
  });

  it('does not match an ordinary network error', () => {
    assert.equal(isTimeoutError({ name: 'FetchError' }), false);
  });

  it('does not match a missing error', () => {
    assert.equal(isTimeoutError(null), false);
    assert.equal(isTimeoutError(undefined), false);
  });
});

describe('getTraccarApiTimeoutMs', () => {
  it('defaults to 20000ms', () => {
    const prev = process.env.TRACCAR_API_TIMEOUT_MS;
    delete process.env.TRACCAR_API_TIMEOUT_MS;
    try {
      assert.equal(getTraccarApiTimeoutMs(), 20000);
    } finally {
      if (prev !== undefined) process.env.TRACCAR_API_TIMEOUT_MS = prev;
    }
  });

  it('honours an explicit override', () => {
    const prev = process.env.TRACCAR_API_TIMEOUT_MS;
    process.env.TRACCAR_API_TIMEOUT_MS = '5000';
    try {
      assert.equal(getTraccarApiTimeoutMs(), 5000);
    } finally {
      if (prev === undefined) delete process.env.TRACCAR_API_TIMEOUT_MS;
      else process.env.TRACCAR_API_TIMEOUT_MS = prev;
    }
  });

  it('stays comfortably below the execution claim watchdog — this is the ordering the ' +
    'whole fix depends on; do not close the gap from either end', () => {
    const prevTimeout = process.env.TRACCAR_API_TIMEOUT_MS;
    const prevClaim = process.env.EXECUTION_CLAIM_TIMEOUT_SEC;
    delete process.env.TRACCAR_API_TIMEOUT_MS;
    delete process.env.EXECUTION_CLAIM_TIMEOUT_SEC;
    try {
      const commandTimeoutMs = getTraccarApiTimeoutMs();
      const claimTimeoutMs = getClaimTimeoutSec() * 1000;
      assert.ok(
        commandTimeoutMs <= claimTimeoutMs - 15000,
        `expected at least 15s margin, got command=${commandTimeoutMs}ms claim=${claimTimeoutMs}ms`,
      );
    } finally {
      if (prevTimeout !== undefined) process.env.TRACCAR_API_TIMEOUT_MS = prevTimeout;
      if (prevClaim !== undefined) process.env.EXECUTION_CLAIM_TIMEOUT_SEC = prevClaim;
    }
  });
});

function withLocalTraccarServer(handler, testFn) {
  return async () => {
    const server = http.createServer(handler);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const prev = {
      base: process.env.TRACCAR_API_BASE_URL,
      user: process.env.TRACCAR_API_USER,
      pass: process.env.TRACCAR_API_PASSWORD,
      timeout: process.env.TRACCAR_API_TIMEOUT_MS,
    };
    process.env.TRACCAR_API_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.TRACCAR_API_USER = 'svc';
    process.env.TRACCAR_API_PASSWORD = 'svc';

    try {
      await testFn();
    } finally {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
      for (const [key, envVar] of Object.entries({
        base: 'TRACCAR_API_BASE_URL',
        user: 'TRACCAR_API_USER',
        pass: 'TRACCAR_API_PASSWORD',
        timeout: 'TRACCAR_API_TIMEOUT_MS',
      })) {
        if (prev[key] === undefined) delete process.env[envVar];
        else process.env[envVar] = prev[key];
      }
    }
  };
}

describe('traccarFetch timeout behavior (local server, no real Traccar needed)', () => {
  it('resolves normally for a prompt, successful response', withLocalTraccarServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    },
    async () => {
      process.env.TRACCAR_API_TIMEOUT_MS = '2000';
      const result = await sendDeviceCommand(101, { type: 'engineStop' });
      assert.equal(result.ok, true);
      assert.equal(result.httpStatus, 200);
    },
  ));

  it('fetchCommandTypes still resolves normally through the same timeout wrapper', withLocalTraccarServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ type: 'engineStop' }, { type: 'engineResume' }]));
    },
    async () => {
      process.env.TRACCAR_API_TIMEOUT_MS = '2000';
      const types = await fetchCommandTypes(101);
      assert.deepEqual(types.map((t) => t.type), ['engineStop', 'engineResume']);
    },
  ));

  it('rejects with a timedOut error when Traccar never responds, well before a real watchdog would fire', withLocalTraccarServer(
    () => {
      // Deliberately never call res.end() — simulates a stalled Traccar relay.
    },
    async () => {
      process.env.TRACCAR_API_TIMEOUT_MS = '150';
      const start = Date.now();
      await assert.rejects(
        () => sendDeviceCommand(101, { type: 'engineStop' }),
        (err) => {
          assert.equal(err.timedOut, true);
          assert.equal(err.statusCode, 504);
          return true;
        },
      );
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 5000, `expected the bounded timeout to fire quickly, took ${elapsed}ms`);
    },
  ));

  it('surfaces a genuine HTTP rejection distinctly from a timeout (real response received, just not 2xx)', withLocalTraccarServer(
    (req, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown command type' }));
    },
    async () => {
      process.env.TRACCAR_API_TIMEOUT_MS = '2000';
      await assert.rejects(
        () => sendDeviceCommand(101, { type: 'engineStop' }),
        (err) => {
          assert.equal(err.timedOut, undefined, 'a real 400 response is not a timeout');
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /Unknown command type/);
          return true;
        },
      );
    },
  ));

  it('does not throw on a malformed (non-JSON) 2xx body — falls back to a raw-text result', withLocalTraccarServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('not actually json {{{');
    },
    async () => {
      process.env.TRACCAR_API_TIMEOUT_MS = '2000';
      const result = await sendDeviceCommand(101, { type: 'engineStop' });
      assert.equal(result.ok, true);
      assert.equal(result.httpStatus, 200);
      assert.equal(result.body.ok, true);
      assert.match(result.body.raw, /not actually json/);
    },
  ));

  it('does not let a late server response after the timeout boundary look like success — ' +
    'the outcome must stay honestly unknown, not silently become "sent"', withLocalTraccarServer(
    (req, res) => {
      // Answer successfully, but only long after our client-side timeout has fired.
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      }, 400);
    },
    async () => {
      process.env.TRACCAR_API_TIMEOUT_MS = '100';
      await assert.rejects(
        () => sendDeviceCommand(101, { type: 'engineStop' }),
        (err) => {
          assert.equal(err.timedOut, true);
          return true;
        },
      );
      // Give the late server response time to arrive and confirm nothing throws
      // or resolves after the fact — the rejected promise above is final.
      await new Promise((resolve) => setTimeout(resolve, 500));
    },
  ));
});
