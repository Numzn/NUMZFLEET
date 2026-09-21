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

export default { createCompanyDevice };
