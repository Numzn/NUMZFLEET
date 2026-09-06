import { publishNotification } from './orchestrator/publishNotification.js';
import { getNotificationIo } from './notificationContext.js';
import { vehicleIntelligenceFindingPolicy } from './policies/notificationPolicyRegistry.js';

const WIRED_CODES = new Set(['fuel.efficiency_declining', 'HEALTH_ATTENTION', 'HEALTH_CRITICAL']);

function isEnabled() {
  const raw = String(process.env.INTELLIGENCE_NOTIFICATIONS_ENABLED || '0').toLowerCase();
  return raw === '1' || raw === 'true';
}

function vehicleLabel(vehicle) {
  if (!vehicle) return 'Vehicle';
  return vehicle.plateNumber || vehicle.name || 'Vehicle';
}

/**
 * Publishes notifications for the subset of intelligenceBuilder.js findings
 * that are meant to reach a manager, not just a dashboard read. Only 2 of the
 * ~15 possible finding codes are wired (see WIRED_CODES) — deliberately: the
 * rest are either display-only nudges (odometer confidence, low sample size)
 * or already notified through their own dedicated producer (maintenance,
 * compliance) and would double-fire here.
 *
 * @param {object[]} findings intelligence.findings, as returned by buildIntelligence()
 * @param {{ fleetVehicleId: string, vehicle?: object|null, companyId?: string|null }} ctx
 */
export async function notifyIntelligenceFindings(findings, { fleetVehicleId, vehicle = null, companyId = null }) {
  if (!isEnabled() || !fleetVehicleId || !Array.isArray(findings) || !findings.length) return;

  const io = getNotificationIo();
  for (const finding of findings) {
    if (!finding?.code || !WIRED_CODES.has(finding.code)) continue;
    const policy = vehicleIntelligenceFindingPolicy({ fleetVehicleId, code: finding.code });
    // eslint-disable-next-line no-await-in-loop -- at most 2 matching findings per vehicle per read; not worth Promise.all's complexity here.
    await publishNotification({
      type: policy.type,
      entityType: policy.entityType,
      entityId: String(fleetVehicleId),
      severity: policy.severity,
      urgency: policy.urgency,
      title: `${vehicleLabel(vehicle)} — ${finding.text}`,
      message: finding.text,
      source: 'fuel-api',
      companyId,
      audience: policy.audience,
      metadata: {
        fleetVehicleId,
        code: finding.code,
        domain: finding.domain ?? null,
        plateNumber: vehicle?.plateNumber ?? null,
        vehicleName: vehicle?.name ?? null,
        observedAt: new Date().toISOString(),
      },
      clientDedupKey: policy.clientDedupKey,
      channels: policy.channels,
    }, { io });
  }
}
