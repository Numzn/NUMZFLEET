/**
 * Phase 1C — Socket.IO manager rooms are company-scoped.
 *
 * The security property under test: a manager of one company must never
 * receive another company's manager events (docs/TENANCY_ARCHITECTURE.md §1).
 *
 * Pure and in-memory — no socket server, no database, no Traccar — because the
 * decision being tested is the membership computation itself, and per §11 a
 * tenancy test must be provable without Traccar running.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { roomsForSocket, resolveManagerRoom, managersRoom, PLATFORM_MANAGERS_ROOM } from './rooms.js';
import { emitVehicleDocumentOcrCompleted } from '../operations/handlers/operationSocketEvents.js';

const COMPANY_A = '0e2fa78c-bad0-429f-8c47-db8a7b0f92cd';
const COMPANY_B = '00000000-0000-0000-0000-000000000001';

/**
 * Models Socket.IO's real join/emit semantics: a client receives an event only
 * if it is in the room the event was addressed to.
 */
function createFakeIo() {
  const clients = [];
  const io = {
    sockets: {},
    to(room) {
      return {
        emit(event, payload) {
          for (const client of clients) {
            if (client.rooms.has(room)) client.received.push({ event, payload });
          }
        },
      };
    },
  };
  return {
    io,
    connect(label, context) {
      const client = { label, rooms: new Set(roomsForSocket(context)), received: [] };
      clients.push(client);
      return client;
    },
  };
}

describe('manager room resolution', () => {
  it('scopes a company manager to their own company room', () => {
    assert.equal(
      resolveManagerRoom({ isManager: true, companyId: COMPANY_A }),
      `managers:${COMPANY_A}`,
    );
  });

  it('gives two companies two different rooms', () => {
    const a = resolveManagerRoom({ isManager: true, companyId: COMPANY_A });
    const b = resolveManagerRoom({ isManager: true, companyId: COMPANY_B });
    assert.notEqual(a, b);
  });

  it('gives a non-manager no manager room', () => {
    assert.equal(resolveManagerRoom({ isManager: false, companyId: COMPANY_A }), null);
  });

  it('puts a platform identity in the platform room, not a customer company room', () => {
    const room = resolveManagerRoom({ isManager: true, isPlatform: true, companyId: null });
    assert.equal(room, PLATFORM_MANAGERS_ROOM);
    assert.ok(!room.includes(COMPANY_A));
    assert.ok(!room.includes(COMPANY_B));
  });

  it('fails closed for a manager with no resolvable company', () => {
    assert.equal(resolveManagerRoom({ isManager: true, companyId: null }), null);
    assert.equal(managersRoom(null), null);
    assert.equal(managersRoom(''), null);
    assert.equal(managersRoom('   '), null);
  });

  it('never produces a shared global room name', () => {
    const rooms = [
      resolveManagerRoom({ isManager: true, companyId: COMPANY_A }),
      resolveManagerRoom({ isManager: true, companyId: COMPANY_B }),
      resolveManagerRoom({ isManager: true, isPlatform: true }),
    ];
    for (const room of rooms) {
      assert.notEqual(room, 'managers', 'the global managers room must not come back');
    }
  });

  it('adds personal rooms for an authenticated identity', () => {
    const rooms = roomsForSocket({ userId: 6, isManager: true, companyId: COMPANY_A });
    assert.deepEqual(rooms, [`managers:${COMPANY_A}`, 'driver-6', 'user-6']);
  });

  it('gives an anonymous connection no rooms at all', () => {
    assert.deepEqual(roomsForSocket({}), []);
    assert.deepEqual(roomsForSocket({ userId: null, isManager: false }), []);
  });
});

describe('cross-company isolation of manager broadcasts', () => {
  it('delivers a company OCR event only to that company, and to no one else', () => {
    const { io, connect } = createFakeIo();

    const managerA = connect('managerA', { userId: 3, isManager: true, companyId: COMPANY_A });
    const managerB = connect('managerB', { userId: 1, isManager: true, companyId: COMPANY_B });
    const platform = connect('platform', { userId: 99, isManager: true, isPlatform: true });
    const driverA = connect('driverA', { userId: 6, isManager: false, companyId: COMPANY_A });

    emitVehicleDocumentOcrCompleted(io, {
      companyId: COMPANY_A,
      documentId: 'doc-1',
      fleetVehicleId: 'vehicle-1',
      ocrStatus: 'completed',
    });

    assert.equal(managerA.received.length, 1, 'the owning company manager should receive it');
    assert.equal(managerA.received[0].event, 'vehicle-document-ocr-completed');
    assert.equal(managerA.received[0].payload.documentId, 'doc-1');

    assert.equal(managerB.received.length, 0, 'Company B manager must NOT receive Company A events');
    assert.equal(platform.received.length, 0, 'platform identity must not silently receive customer traffic');
    assert.equal(driverA.received.length, 0, 'a non-manager must not receive manager broadcasts');
  });

  it('is symmetric — Company B events never reach Company A', () => {
    const { io, connect } = createFakeIo();
    const managerA = connect('managerA', { userId: 3, isManager: true, companyId: COMPANY_A });
    const managerB = connect('managerB', { userId: 1, isManager: true, companyId: COMPANY_B });

    emitVehicleDocumentOcrCompleted(io, { companyId: COMPANY_B, documentId: 'doc-2' });

    assert.equal(managerB.received.length, 1);
    assert.equal(managerA.received.length, 0, 'Company A manager must NOT receive Company B events');
  });

  it('drops a broadcast with no company rather than sending it widely', () => {
    const { io, connect } = createFakeIo();
    const managerA = connect('managerA', { userId: 3, isManager: true, companyId: COMPANY_A });
    const managerB = connect('managerB', { userId: 1, isManager: true, companyId: COMPANY_B });

    emitVehicleDocumentOcrCompleted(io, { documentId: 'doc-3' });
    emitVehicleDocumentOcrCompleted(io, { companyId: null, documentId: 'doc-4' });

    assert.equal(managerA.received.length, 0);
    assert.equal(managerB.received.length, 0);
  });
});

describe('reconnect behaviour', () => {
  it('re-derives the same company room on reconnect', () => {
    const first = roomsForSocket({ userId: 3, isManager: true, companyId: COMPANY_A });
    const afterReconnect = roomsForSocket({ userId: 3, isManager: true, companyId: COMPANY_A });
    assert.deepEqual(afterReconnect, first);
  });

  it('follows the identity when their company changes, with no stale membership', () => {
    const before = roomsForSocket({ userId: 3, isManager: true, companyId: COMPANY_B });
    const after = roomsForSocket({ userId: 3, isManager: true, companyId: COMPANY_A });

    assert.ok(before.includes(`managers:${COMPANY_B}`));
    assert.ok(after.includes(`managers:${COMPANY_A}`));
    assert.ok(!after.includes(`managers:${COMPANY_B}`), 'old company room must not persist');
  });
});
