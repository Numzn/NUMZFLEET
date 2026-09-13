import { v4 as uuid } from 'uuid';
import { Driver, DriverAssignment, NumzUser } from '../../models/index.js';
import {
  createTraccarDriver, updateTraccarDriver, deleteTraccarDriver, syncPersonDriverLink,
} from './driverTraccarSync.js';

/**
 * NUMZFLEET's own Driver domain. `Driver.id` (a NUMZFLEET UUID) is the
 * business identity — `traccarDriverId` is an integration reference only,
 * never used to resolve tenancy. Company is always derived from
 * req.auth.companyId, never a client-supplied value — same rule as
 * modules/people/peopleService.js, which this module is deliberately shaped
 * to resemble.
 */

const PATCHABLE_FIELDS = ['name', 'phone', 'uniqueId', 'status'];

function requireCompanyId(req) {
  const companyId = req.auth?.companyId;
  if (!companyId) {
    const err = new Error('No organization context');
    err.statusCode = 403;
    throw err;
  }
  return companyId;
}

/** The one ownership check every read/write below shares: does this driver belong to the caller's own company? */
async function requireOwnedDriver(companyId, driverId) {
  const driver = await Driver.findOne({ where: { id: driverId, companyId } });
  if (!driver) {
    const err = new Error('Driver not found');
    err.statusCode = 404;
    throw err;
  }
  return driver;
}

/**
 * `personId` at the API boundary is a Traccar user id — the same identifier
 * /api/people already keys on (GET /api/people/:traccarUserId) — never the
 * internal numz_users.id UUID, which the frontend never sees. Resolves and
 * verifies the person belongs to the caller's own company; never trusted
 * blind.
 */
async function resolveOwnedPersonByTraccarId(companyId, personId) {
  if (personId == null) return null;
  const person = await NumzUser.findOne({ where: { traccarUserId: Number(personId), companyId } });
  if (!person) {
    const err = new Error('Person not found');
    err.statusCode = 404;
    throw err;
  }
  return person;
}

/** Shapes a Driver row for the frontend — personId (Traccar id), never the raw numzUserId UUID. */
function toDriverDto(driver, personTraccarId) {
  return {
    id: driver.id,
    personId: personTraccarId ?? null,
    traccarDriverId: driver.traccarDriverId,
    name: driver.name,
    phone: driver.phone,
    uniqueId: driver.uniqueId,
    status: driver.status,
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  };
}

async function attachPersonTraccarId(driver) {
  if (driver.numzUserId == null) return toDriverDto(driver, null);
  const person = await NumzUser.findByPk(driver.numzUserId);
  return toDriverDto(driver, person?.traccarUserId ?? null);
}

export async function listCompanyDrivers(req) {
  const companyId = requireCompanyId(req);
  const drivers = await Driver.findAll({ where: { companyId }, order: [['name', 'ASC']] });
  const numzUserIds = [...new Set(drivers.map((d) => d.numzUserId).filter((id) => id != null))];
  const people = numzUserIds.length
    ? await NumzUser.findAll({ where: { id: numzUserIds } })
    : [];
  const traccarIdByNumzUserId = new Map(people.map((p) => [p.id, p.traccarUserId]));
  return drivers.map((driver) => toDriverDto(driver, traccarIdByNumzUserId.get(driver.numzUserId) ?? null));
}

export async function getCompanyDriver(req, driverId) {
  const companyId = requireCompanyId(req);
  const driver = await requireOwnedDriver(companyId, driverId);
  return attachPersonTraccarId(driver);
}

/**
 * Creates a driver: a Traccar driver (so telemetry can identify them) plus
 * the NUMZFLEET row that owns the business relationship, together — Traccar
 * first, compensating-deleted if the NUMZFLEET write then fails, the same
 * order and reasoning as peopleService.js's createCompanyPerson.
 *
 * personId (a Traccar user id, matching /api/people's own key) is optional —
 * a driver profile does not require a NUMZFLEET sign-in account — but when
 * given must already belong to this company. This is the one enforcement
 * point for "Company A cannot link a Company B person to a driver."
 */
export async function createCompanyDriver(req) {
  const companyId = requireCompanyId(req);
  const { name, phone, personId } = req.body || {};
  let { uniqueId } = req.body || {};

  if (!name || !String(name).trim()) {
    const err = new Error('Driver name is required');
    err.statusCode = 400;
    throw err;
  }
  const trimmedName = String(name).trim();
  uniqueId = uniqueId && String(uniqueId).trim() ? String(uniqueId).trim() : `numz-${uuid().slice(0, 8)}`;

  const person = await resolveOwnedPersonByTraccarId(companyId, personId);

  let traccarDriver;
  try {
    traccarDriver = await createTraccarDriver({ name: trimmedName, uniqueId, phone: phone || null });
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 409) {
      const dupErr = new Error('A driver with this identifier already exists');
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }

  try {
    const driver = await Driver.create({
      companyId,
      numzUserId: person?.id ?? null,
      traccarDriverId: traccarDriver.id,
      name: trimmedName,
      phone: phone || null,
      uniqueId,
      status: 'active',
    });
    if (person?.traccarUserId != null) {
      await syncPersonDriverLink(person.traccarUserId, traccarDriver.id, true);
    }
    return toDriverDto(driver, person?.traccarUserId ?? null);
  } catch (err) {
    // Compensating delete — a Traccar driver nothing in NUMZFLEET owns is an
    // orphan, not a partial success.
    await deleteTraccarDriver(traccarDriver.id).catch(() => {});
    if (err.name === 'SequelizeUniqueConstraintError') {
      const dupErr = new Error('A driver with this identifier already exists');
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }
}

/**
 * Updates are whitelisted (PATCHABLE_FIELDS) and re-verify ownership first —
 * a cross-company driverId 404s before anything is touched, mirroring
 * updateCompanyPerson. Changing personId re-validates the new person
 * belongs to this company, the same way create does.
 */
export async function updateCompanyDriver(req, driverId) {
  const companyId = requireCompanyId(req);
  const driver = await requireOwnedDriver(companyId, driverId);
  const body = req.body || {};

  const updates = {};
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (typeof updates.name === 'string') updates.name = updates.name.trim() || driver.name;
  if (typeof updates.uniqueId === 'string') updates.uniqueId = updates.uniqueId.trim() || driver.uniqueId;

  let personChanged = false;
  let nextPerson = null;
  if ('personId' in body) {
    nextPerson = await resolveOwnedPersonByTraccarId(companyId, body.personId);
    personChanged = (nextPerson?.id ?? null) !== driver.numzUserId;
    updates.numzUserId = nextPerson?.id ?? null;
  }

  try {
    await driver.update(updates);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const dupErr = new Error('A driver with this identifier already exists');
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }

  if (driver.traccarDriverId != null) {
    await updateTraccarDriver(driver.traccarDriverId, {
      name: driver.name, uniqueId: driver.uniqueId, phone: driver.phone,
    }).catch((err) => {
      console.warn('[driverService] Traccar driver update sync failed (non-fatal):', err?.message || err);
    });
  }

  if (personChanged && driver.traccarDriverId != null) {
    if (nextPerson?.traccarUserId != null) {
      await syncPersonDriverLink(nextPerson.traccarUserId, driver.traccarDriverId, true);
    }
  }

  return attachPersonTraccarId(driver);
}

/**
 * Refuses to delete a driver with an active vehicle assignment (409) — the
 * same "unassign first" invariant deviceAssignment's own FK (ON DELETE
 * RESTRICT) would enforce anyway, surfaced here as a clear message instead
 * of a raw constraint error.
 */
export async function deleteCompanyDriver(req, driverId) {
  const companyId = requireCompanyId(req);
  const driver = await requireOwnedDriver(companyId, driverId);

  const activeAssignment = await DriverAssignment.findOne({
    where: { driverId: driver.id, isActive: true },
  });
  if (activeAssignment) {
    const err = new Error('Driver is currently assigned to a vehicle — unassign first');
    err.statusCode = 409;
    throw err;
  }

  if (driver.traccarDriverId != null) {
    await deleteTraccarDriver(driver.traccarDriverId).catch((err) => {
      console.warn('[driverService] Traccar driver delete sync failed (non-fatal):', err?.message || err);
    });
  }
  await driver.destroy();
}
