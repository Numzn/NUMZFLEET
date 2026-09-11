/**
 * Phase 2 — company access is granted through the company's Traccar GROUP,
 * never through per-device grants.
 *
 * The September 2026 incident was caused by exactly such per-device grants:
 * rows in tc_user_device that outlived whatever created them, pointing at
 * another company's devices, invisible to NUMZFLEET's own model. They were
 * removed, and nothing may reintroduce them.
 *
 * This is a repo-wide static guard rather than a runtime spy on one code path,
 * deliberately: the invariant is "no call site anywhere creates a device
 * grant", and only scanning the source proves that for call sites no test
 * happens to exercise. Node 20 has no module mocking, so a spy could not cover
 * them all anyway.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, acc);
    } else if (entry.endsWith('.js') && !entry.endsWith('.test.js')) {
      acc.push(full);
    }
  }
  return acc;
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path),
  body: readFileSync(path, 'utf8'),
}));

describe('Traccar permissions are group-scoped, never device-scoped', () => {
  it('scans a meaningful number of source files', () => {
    // Guards the guard: a broken walk would make every assertion below vacuous.
    assert.ok(files.length > 50, `expected to scan the service tree, saw ${files.length} files`);
  });

  it('never writes to tc_user_device', () => {
    const offenders = files.filter(({ body }) => (
      /\b(INSERT\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\b[\s\S]{0,80}tc_user_device/i.test(body)
    ));
    assert.deepEqual(
      offenders.map((f) => f.path),
      [],
      'no code may create, modify or remove per-device Traccar grants',
    );
  });

  it('never links a userId to a deviceId (the tc_user_device grant shape)', () => {
    // Traccar's /api/permissions links any two entities, so the payload shape
    // is what matters, not the endpoint. {deviceId, maintenanceId} is a
    // legitimate device-to-maintenance link and writes tc_device_maintenance.
    // Only {userId, deviceId} writes tc_user_device, and that is the one shape
    // that must never appear.
    const offenders = [];
    for (const { path, body } of files) {
      const calls = body.matchAll(/['"`]\/api\/permissions['"`][\s\S]{0,400}?\}\)/g);
      for (const [snippet] of calls) {
        if (/\buserId\b/.test(snippet) && /\bdeviceId\b/.test(snippet)) {
          offenders.push(`${path}: ${snippet.slice(0, 90)}`);
        }
      }
    }
    assert.deepEqual(offenders, [], 'user access must come from the company group, never a per-device grant');
  });

  it('grants and revokes only ever link a user to a group', () => {
    const provisioning = files.find((f) => f.path.endsWith('services/companyProvisioningService.js'));
    assert.ok(provisioning, 'companyProvisioningService.js must exist');

    const payloads = [...provisioning.body.matchAll(/JSON\.stringify\(\{\s*userId[^}]*\}\)/g)].map(([m]) => m);
    assert.ok(payloads.length >= 2, 'expected both the grant and the revoke payload');
    for (const payload of payloads) {
      assert.ok(/groupId/.test(payload), `permission payload must be group-scoped: ${payload}`);
      assert.ok(!/deviceId/.test(payload), `permission payload must not be device-scoped: ${payload}`);
    }
  });
});
