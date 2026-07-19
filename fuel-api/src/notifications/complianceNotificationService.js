import { publishNotification } from './orchestrator/publishNotification.js';
import { getNotificationIo } from './notificationContext.js';
import { complianceFindingPolicy } from './policies/notificationPolicyRegistry.js';

function toTitle(type, status) {
  const label = String(type || 'Compliance').replaceAll('_', ' ').toLowerCase();
  const titled = label.charAt(0).toUpperCase() + label.slice(1);
  const st = String(status || '').toLowerCase();
  if (st === 'overdue') return `${titled} overdue`;
  if (st === 'expired') return `${titled} expired`;
  if (st === 'due') return `${titled} due`;
  return `${titled} upcoming`;
}

function toMessage(finding, vehicle) {
  const vehicleLabel = vehicle?.plateNumber || vehicle?.name || 'Vehicle';
  const typeLabel = String(finding.type || 'Compliance').replaceAll('_', ' ').toLowerCase();
  if (finding.daysRemaining == null) return `${vehicleLabel} — ${typeLabel} requires attention`;
  if (finding.daysRemaining < 0) {
    return `${vehicleLabel} — ${typeLabel} overdue by ${Math.abs(finding.daysRemaining)} day(s)`;
  }
  if (finding.daysRemaining === 0) {
    return `${vehicleLabel} — ${typeLabel} due today`;
  }
  return `${vehicleLabel} — ${typeLabel} due in ${finding.daysRemaining} day(s)`;
}

export async function notifyComplianceFinding({
  finding,
  vehicle = null,
  companyId = null,
}) {
  if (!finding?.fleetVehicleId || !finding?.type || !finding?.status) return;
  if (['valid', 'unknown'].includes(String(finding.status).toLowerCase())) return;

  const io = getNotificationIo();
  const policy = complianceFindingPolicy({
    fleetVehicleId: finding.fleetVehicleId,
    type: finding.type,
    status: finding.status,
  });
  // Delivery boundary: all compliance notifications go through the existing
  // publishNotification orchestrator (no parallel notification pipeline).
  await publishNotification({
    type: policy.type,
    entityType: policy.entityType,
    entityId: String(finding.complianceId || `${finding.fleetVehicleId}:${finding.type}`),
    severity: policy.severity,
    title: toTitle(finding.type, finding.status),
    message: toMessage(finding, vehicle),
    source: 'fuel-api',
    companyId,
    audience: policy.audience,
    metadata: {
      fleetVehicleId: finding.fleetVehicleId,
      complianceId: finding.complianceId ?? null,
      type: finding.type,
      status: finding.status,
      dueDate: finding.dueDate ?? null,
      daysRemaining: finding.daysRemaining ?? null,
      documentId: finding.documentId ?? null,
      vehicleName: vehicle?.name ?? null,
      plateNumber: vehicle?.plateNumber ?? null,
      observedAt: new Date().toISOString(),
    },
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
  }, { io });
}
