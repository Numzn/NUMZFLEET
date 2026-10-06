import { traccarServiceFetch } from './traccarServiceClient.js';
import { ensureDeviceInCompany } from './companyProvisioningService.js';

/**
 * Creates a Traccar device on behalf of an authenticated company and
 * immediately registers NUMZFLEET ownership for it via ensureDeviceInCompany.
 * This is what lets a brand-new device become company-owned before any
 * vehicle assignment exists — the assignment path
 * (vehicleFleetService.assignDevice) calls the same primitive with a
 * vehicleId; here it is called with vehicleId: null.
 *
 * Traccar (MySQL) and company_devices (Postgres) are two separate stores, so
 * this cannot be one transaction. If Traccar creates the device but
 * ownership registration then fails, an orphaned, unowned Traccar device is
 * strictly worse than no device at all (it could never appear as owned by
 * anyone and would sit invisible to every company), so this makes a
 * best-effort attempt to delete the just-created Traccar device before
 * rethrowing — the same best-effort-cleanup shape already used by
 * verifyTraccarCredentials's session teardown in traccarServiceClient.js.
 * The rethrown error always carries the real cause; a failed cleanup is
 * logged, never swallowed silently.
 */
export async function createCompanyDevice(companyId, payload = {}) {
  if (!companyId) {
    const err = new Error('A resolved company is required to create a device');
    err.statusCode = 403;
    throw err;
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const uniqueId = typeof payload.uniqueId === 'string' ? payload.uniqueId.trim() : '';
  if (!name || !uniqueId) {
    const err = new Error('name and uniqueId are required');
    err.statusCode = 400;
    throw err;
  }

  const {
    phone, model, contact, category, groupId, calendarId, disabled, attributes,
  } = payload;

  const createBody = {
    name,
    uniqueId,
    ...(phone != null ? { phone } : {}),
    ...(model != null ? { model } : {}),
    ...(contact != null ? { contact } : {}),
    ...(category != null ? { category } : {}),
    ...(groupId != null ? { groupId } : {}),
    ...(calendarId != null ? { calendarId } : {}),
    ...(disabled != null ? { disabled } : {}),
    ...(attributes != null ? { attributes } : {}),
  };

  const device = await traccarServiceFetch('/api/devices', {
    method: 'POST',
    body: JSON.stringify(createBody),
  });

  try {
    await ensureDeviceInCompany(companyId, device.id, null);
  } catch (ownershipErr) {
    console.error(
      `[deviceProvisioning] Traccar device ${device.id} created but company ownership registration failed — attempting compensating delete:`,
      ownershipErr?.message || ownershipErr,
    );
    try {
      await traccarServiceFetch(`/api/devices/${device.id}`, { method: 'DELETE' });
    } catch (cleanupErr) {
      console.error(
        `[deviceProvisioning] compensating delete of Traccar device ${device.id} also failed — it now exists in Traccar with no NUMZFLEET owner and needs manual reconciliation:`,
        cleanupErr?.message || cleanupErr,
      );
    }
    const err = new Error('Device was created but could not be registered to your company. Please try again.');
    err.statusCode = ownershipErr?.statusCode >= 400 && ownershipErr.statusCode < 500 ? ownershipErr.statusCode : 502;
    throw err;
  }

  return device;
}

// ---------------------------------------------------------------------------
// Edit and remove — company-scoped, through fuel-api
//
// The browser used to PUT / DELETE /api/devices/:id straight at Traccar, so it
// could rewrite a tracker's identity (uniqueId), move it between Traccar groups,
// and delete it while leaving NUMZFLEET's ownership and assignment rows behind.
// These two functions are the only supported way to change a tracker now:
// the caller's company is checked first, only fields a fleet manager legitimately
// owns can change, and removal cleans up NUMZFLEET's own records too.
// ---------------------------------------------------------------------------

const TEXT_FIELD_MAX = 128;
const CATEGORY_PATTERN = /^[a-z]{1,32}$/;

/** What a fleet manager may change. Identity (uniqueId), group, disabled/expiry, attributes are platform-managed. */
export const EDITABLE_DEVICE_FIELDS = ['name', 'phone', 'model', 'category'];

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function cleanText(value, field, { required = false } = {}) {
  if (value == null) {
    if (required) throw httpError(400, `${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw httpError(400, `${field} must be text`);
  const text = value.trim();
  if (!text) {
    if (required) throw httpError(400, `${field} cannot be empty`);
    return null;
  }
  if (text.length > TEXT_FIELD_MAX) throw httpError(400, `${field} is too long`);
  return text;
}

/**
 * Validates an edit request. Rejects (rather than silently ignores) any field outside
 * the editable set, so a request that tries to change identity or group fails loudly.
 */
export function sanitizeDevicePatch(body = {}) {
  const input = body && typeof body === 'object' ? body : {};
  const forbidden = Object.keys(input).filter((key) => !EDITABLE_DEVICE_FIELDS.includes(key));
  if (forbidden.length) {
    throw httpError(400, `These fields cannot be changed here: ${forbidden.join(', ')}`);
  }

  const patch = {};
  if ('name' in input) patch.name = cleanText(input.name, 'name', { required: true });
  if ('phone' in input) patch.phone = cleanText(input.phone, 'phone');
  if ('model' in input) patch.model = cleanText(input.model, 'model');
  if ('category' in input) {
    const category = cleanText(input.category, 'category');
    if (category != null && !CATEGORY_PATTERN.test(category)) throw httpError(400, 'category is not valid');
    patch.category = category;
  }
  if (!Object.keys(patch).length) throw httpError(400, 'Nothing to update');
  return patch;
}

function parseDeviceId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'A valid device id is required');
  return id;
}

/**
 * The device must already belong to the caller's company (owned, or assigned to one
 * of its vehicles). Anything else — missing, another company's, unowned — is the
 * same 404, so the response never reveals whether a device id exists elsewhere.
 */
async function assertDeviceInCompany(auth, deviceId, deps) {
  const accessible = await deps.getAccessibleIds(auth);
  if (!accessible.map(Number).includes(deviceId)) throw httpError(404, 'Device not found');
}

async function defaultReleaseOwnership(deviceId) {
  const { sequelize, DeviceAssignment, CompanyDevice } = await import('../models/index.js');
  await sequelize.transaction(async (transaction) => {
    await DeviceAssignment.update(
      { isActive: false, unassignedAt: new Date() },
      { where: { deviceId, isActive: true }, transaction },
    );
    await CompanyDevice.destroy({ where: { traccarDeviceId: deviceId }, transaction });
  });
}

async function resolveDeps(injected) {
  // Tests inject every dependency, which also means the database layer is never loaded.
  if (injected.getAccessibleIds && injected.traccarFetch && injected.releaseOwnership) return injected;
  const { getAccessibleTraccarDeviceIds } = await import('./fleetDeviceSnapshotService.js');
  return {
    getAccessibleIds: getAccessibleTraccarDeviceIds,
    traccarFetch: traccarServiceFetch,
    releaseOwnership: defaultReleaseOwnership,
    ...injected,
  };
}

/**
 * Edit a tracker the caller's company owns. Reads the current Traccar record and
 * writes it back with only the whitelisted fields changed, so identity, group,
 * attributes and every other field are carried over untouched.
 */
export async function updateCompanyDevice(auth, deviceIdInput, body, injected = {}) {
  const deps = await resolveDeps(injected);
  const deviceId = parseDeviceId(deviceIdInput);
  const patch = sanitizeDevicePatch(body);
  await assertDeviceInCompany(auth, deviceId, deps);

  const current = await deps.traccarFetch(`/api/devices/${deviceId}`);
  if (!current) throw httpError(404, 'Device not found');

  return deps.traccarFetch(`/api/devices/${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ ...current, ...patch, id: deviceId }),
  });
}

/**
 * Remove a tracker the caller's company owns. Traccar goes first: if it refuses,
 * nothing else has changed. Then NUMZFLEET's own records are cleaned up — the
 * active vehicle assignment ends and the ownership row goes — so no vehicle is
 * left pointing at a tracker that no longer exists.
 */
export async function removeCompanyDevice(auth, deviceIdInput, injected = {}) {
  const deps = await resolveDeps(injected);
  const deviceId = parseDeviceId(deviceIdInput);
  await assertDeviceInCompany(auth, deviceId, deps);

  await deps.traccarFetch(`/api/devices/${deviceId}`, { method: 'DELETE' });

  try {
    await deps.releaseOwnership(deviceId);
  } catch (cleanupErr) {
    // The tracker is already gone from Traccar and the snapshot only ever lists
    // devices Traccar still has, so stale rows are inert — but say so loudly.
    console.error(
      `[deviceProvisioning] device ${deviceId} was removed from Traccar but its NUMZFLEET ownership/assignment cleanup failed and needs manual reconciliation:`,
      cleanupErr?.message || cleanupErr,
    );
  }
}

export default { createCompanyDevice, updateCompanyDevice, removeCompanyDevice };
