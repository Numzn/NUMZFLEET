#!/usr/bin/env node
/**
 * Black-box regression test for the GT06 stale-connection / login race in Traccar.
 *
 * Drives raw GT06 frames over TCP at a *throwaway* Traccar container and checks,
 * through Traccar's own REST API, which frames were attributed to the device.
 * It never talks to a NUMZFLEET service or database.
 *
 *   node gt06-session-race.mjs --expect stock     # unpatched Traccar: race scenarios are DROPPED
 *   node gt06-session-race.mjs --expect patched   # patched Traccar:   every scenario is STORED
 *
 * Options (or env): --api / API_URL (default http://127.0.0.1:18082),
 *                   --host / GT06_HOST (127.0.0.1), --port / GT06_PORT (15023).
 *
 * SAFETY: it creates a user and devices via Traccar's API, so it refuses any
 * non-loopback target. Never point it at a real server (--allow-remote exists
 * only for a throwaway instance on another host).
 *
 * Background: Traccar's ConnectionManager.getDeviceSession() evicts the device's
 * previous connection mapping on every login ("last login wins"), and
 * Gt06ProtocolDecoder returns null for any non-login frame on a connection with no
 * mapping. A late login replayed from an abandoned socket therefore steals the
 * session from the live socket; when that stale socket closes, the live one is
 * left with no session and every frame it sends is silently discarded.
 */
import net from 'node:net';
import { parseArgs } from 'node:util';

const { values: opts } = parseArgs({
  options: {
    expect: { type: 'string', default: 'patched' },
    api: { type: 'string', default: process.env.API_URL || 'http://127.0.0.1:18082' },
    host: { type: 'string', default: process.env.GT06_HOST || '127.0.0.1' },
    port: { type: 'string', default: process.env.GT06_PORT || '15023' },
    'allow-remote': { type: 'boolean', default: false },
  },
});

if (!['stock', 'patched'].includes(opts.expect)) {
  console.error('--expect must be "stock" or "patched"');
  process.exit(2);
}

// This test registers a user and devices through Traccar's API. Refuse anything
// that is not a local throwaway instance so it can never touch a real fleet.
const isLoopback = (hostname) => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hostname);
if (!opts['allow-remote'] && (!isLoopback(new URL(opts.api).hostname) || !isLoopback(opts.host))) {
  console.error(
    `refusing to run against non-loopback target (${opts.api}, ${opts.host}): `
    + 'this test creates users and devices. Use a throwaway local container.',
  );
  process.exit(2);
}

const GT06_PORT = Number(opts.port);
const AUTH = `Basic ${Buffer.from('repro@example.test:repro-pass').toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// ---------------------------------------------------------------- GT06 frames
const u16 = (n) => Buffer.from([(n >> 8) & 0xff, n & 0xff]);
const u24 = (n) => Buffer.from([(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
const u32 = (n) => Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);

/** CRC-ITU (CRC-16/X-25), as used by GT06 trackers. */
const crc16 = (buf) => {
  let crc = 0xffff;
  buf.forEach((byte) => {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc & 1) ? (crc >> 1) ^ 0x8408 : crc >> 1;
  });
  return (~crc) & 0xffff;
};

const frame = (protocol, body, serial) => {
  const inner = Buffer.concat([Buffer.from([protocol]), body, u16(serial)]);
  const length = inner.length + 2; // + CRC
  const head = Buffer.from([length]);
  const crc = crc16(Buffer.concat([head, inner]));
  return Buffer.concat([Buffer.from([0x78, 0x78]), head, inner, u16(crc), Buffer.from([0x0d, 0x0a])]);
};

const loginFrame = (imei, serial) => frame(
  0x01,
  Buffer.concat([Buffer.from(`0${imei}`, 'hex'), u16(0x2c0b)]),
  serial,
);

/** GPS + LBS location packet (0x12): valid fix, south/east hemisphere. */
const locationFrame = (when, lat, lon, serial) => {
  const date = Buffer.from([
    when.getUTCFullYear() - 2000, when.getUTCMonth() + 1, when.getUTCDate(),
    when.getUTCHours(), when.getUTCMinutes(), when.getUTCSeconds(),
  ]);
  const coord = (deg) => u32(Math.round(Math.abs(deg) * 60 * 30000));
  const flags = 0x1000 | 90; // GPS valid, course 90, north bit clear => south; west bit clear => east
  return frame(
    0x12,
    Buffer.concat([
      date, Buffer.from([0xc8]), coord(lat), coord(lon), Buffer.from([30]), u16(flags),
      u16(645), Buffer.from([1]), u16(1000), u24(2000),
    ]),
    serial,
  );
};

// ------------------------------------------------------------------ TCP side
const connect = () => new Promise((resolve, reject) => {
  const socket = net.connect({ host: opts.host, port: GT06_PORT });
  const received = [];
  socket.on('data', (chunk) => received.push(chunk));
  socket.once('error', reject);
  socket.once('connect', () => resolve({
    socket,
    received,
    send: (buf) => new Promise((ok) => { socket.write(buf, ok); }),
    close: () => new Promise((ok) => { socket.end(); socket.once('close', ok); setTimeout(ok, 500); }),
  }));
});

/** Wait until the connection has received `bytes` bytes (an ACK), or time out. */
const waitForBytes = async (conn, bytes, timeoutMs = 4000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (Buffer.concat(conn.received).length >= bytes) return true;
    await sleep(50);
  }
  return false;
};

// ------------------------------------------------------------------ REST side
const api = async (path, init = {}) => {
  const response = await fetch(`${opts.api}${path}`, {
    ...init,
    headers: { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json', ...init.headers },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text; // Traccar reports some errors as plain-text stack traces
  }
  return { status: response.status, body };
};

const ensureUser = async () => {
  // On an empty database the first registered user becomes the administrator;
  // on a reused container the user already exists and this is a harmless no-op.
  await fetch(`${opts.api}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'repro', email: 'repro@example.test', password: 'repro-pass' }),
  });
  // GET /api/session does not honour Basic auth, so probe a regular endpoint.
  const probe = await api('/api/devices');
  if (probe.status !== 200) throw new Error(`cannot authenticate to Traccar API (HTTP ${probe.status})`);
};

const createDevice = async (name, imei) => {
  const { status, body } = await api('/api/devices', {
    method: 'POST', body: JSON.stringify({ name, uniqueId: imei }),
  });
  if (status !== 200) throw new Error(`device create failed: HTTP ${status}`);
  return body.id;
};

const countPositions = async (deviceId) => {
  const { body } = await api(
    `/api/reports/route?deviceId=${deviceId}&from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z`,
  );
  return Array.isArray(body) ? body.length : -1;
};

/**
 * Persistence is asynchronous, so poll until the count reaches `expected` or has
 * been stable for ~2 s (a dropped frame never arrives, so stability is the signal).
 */
const storedPositions = async (deviceId, expected) => {
  let last = -1;
  let stableSince = Date.now();
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const count = await countPositions(deviceId);
    if (count === expected) return count;
    if (count !== last) { last = count; stableSince = Date.now(); }
    if (Date.now() - stableSince >= 2000) break;
    // eslint-disable-next-line no-await-in-loop
    await sleep(250);
  }
  return last;
};

const deviceStatus = async (deviceId) => (await api(`/api/devices?id=${deviceId}`)).body?.[0]?.status;

// ----------------------------------------------------------------- scenarios
let imeiCounter = Math.floor(Math.random() * 1e6);
const nextImei = () => { imeiCounter += 1; return `35958601${String(imeiCounter).padStart(7, '0')}`; };
let tick = Date.now() - 120_000;
const nextFix = () => { tick += 2000; return new Date(tick); };
let serial = 1;
const nextSerial = () => { serial += 1; return serial; };

const login = async (conn, imei) => {
  await conn.send(loginFrame(imei, nextSerial()));
  const acked = await waitForBytes(conn, 10);
  if (!acked) throw new Error('login was not ACKed');
};

const sendFixes = async (conn, count) => {
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await conn.send(locationFrame(nextFix(), -15.4167 - i * 0.0001, 28.2833 + i * 0.0001, nextSerial()));
    // eslint-disable-next-line no-await-in-loop
    await sleep(80);
  }
  await sleep(700); // let the processing pipeline persist them
};

const scenarios = [
  {
    name: 'control: single connection',
    race: false,
    run: async (imei, deviceId) => {
      const a = await connect();
      await login(a, imei);
      await sendFixes(a, 3);
      await a.close();
      return { sent: 3 };
    },
  },
  {
    name: 'legit reconnect: A closes, then B logs in',
    race: false,
    run: async (imei, deviceId) => {
      const a = await connect();
      await login(a, imei);
      await sendFixes(a, 1);
      await a.close();
      const b = await connect();
      await login(b, imei);
      await sendFixes(b, 3);
      await b.close();
      return { sent: 4 };
    },
  },
  {
    name: 'RACE: stale login replayed from abandoned socket, then it closes',
    race: true,
    run: async (imei, deviceId) => {
      const a = await connect(); // the socket the tracker later abandons
      await login(a, imei);
      const b = await connect(); // the live socket
      await login(b, imei);
      await sendFixes(b, 1); // proves B decodes before the race
      await a.send(loginFrame(imei, nextSerial())); // late/queued login arrives on the OLD socket
      await sleep(300);
      await a.close(); // ...and that socket goes away
      await sleep(300);
      await sendFixes(b, 3); // live socket keeps reporting
      const liveStatus = await deviceStatus(deviceId); // sampled while B is still connected
      await b.close();
      return { sent: 4, liveStatus };
    },
  },
  {
    name: 'RACE: stale login replayed from abandoned socket, it stays open',
    race: true,
    run: async (imei, deviceId) => {
      const a = await connect();
      await login(a, imei);
      const b = await connect();
      await login(b, imei);
      await a.send(loginFrame(imei, nextSerial()));
      await sleep(300);
      await sendFixes(b, 3);
      await a.close();
      await b.close();
      return { sent: 3 };
    },
  },
  {
    name: 'RACE: newer socket is the dead one, older socket keeps reporting',
    race: true,
    run: async (imei, deviceId) => {
      const a = await connect(); // the live socket
      await login(a, imei);
      const b = await connect(); // a newer login that goes nowhere
      await login(b, imei);
      await sendFixes(a, 3);
      await b.close();
      await sleep(300);
      await sendFixes(a, 1);
      const liveStatus = await deviceStatus(deviceId);
      await a.close();
      return { sent: 4, liveStatus };
    },
  },
];

const main = async () => {
  await ensureUser();
  const results = [];
  for (const scenario of scenarios) {
    const imei = nextImei();
    // eslint-disable-next-line no-await-in-loop
    const deviceId = await createDevice(`repro-${results.length}`, imei);
    // eslint-disable-next-line no-await-in-loop
    const { sent, liveStatus } = await scenario.run(imei, deviceId);
    // eslint-disable-next-line no-await-in-loop
    await sleep(500);
    // eslint-disable-next-line no-await-in-loop
    const stored = await storedPositions(deviceId, sent);
    // eslint-disable-next-line no-await-in-loop
    const status = await deviceStatus(deviceId);
    results.push({ ...scenario, deviceId, sent, stored, status, liveStatus });
  }

  console.log(`\nTraccar API ${opts.api}, GT06 ${opts.host}:${GT06_PORT}, expecting: ${opts.expect}\n`);
  let failures = 0;
  results.forEach((r) => {
    const allStored = r.stored === r.sent;
    // Non-race scenarios must always be fully stored. Race scenarios are dropped on
    // stock Traccar and must be fully stored once patched.
    const expectStored = !r.race || opts.expect === 'patched';
    // While the live socket is still open the device must not read as offline.
    const liveOk = !(opts.expect === 'patched' && r.liveStatus !== undefined && r.liveStatus !== 'online');
    const pass = (expectStored ? allStored : r.stored < r.sent) && liveOk;
    if (!pass) failures += 1;
    console.log(
      `${pass ? 'PASS' : 'FAIL'}  stored ${String(r.stored).padStart(2)}/${r.sent}  dev=${r.deviceId} live=${String(r.liveStatus ?? '-').padEnd(8)} ${r.name}`,
    );
  });
  console.log(failures ? `\n${failures} scenario(s) did not match "${opts.expect}"` : '\nall scenarios matched');
  process.exit(failures ? 1 : 0);
};

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
