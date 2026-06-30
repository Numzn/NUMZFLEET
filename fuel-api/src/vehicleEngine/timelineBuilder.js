import { findCompletedRefuelsByVehicleId } from '../repositories/operationSessionRefuelRepository.js';

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pushEntry(entries, entry) {
  if (!entry.occurredAt) return;
  entries.push(entry);
}

/**
 * Layer 6 — recent vehicle history from existing records.
 * Source may move to the event bus later; response shape stays stable.
 */
export async function buildTimeline({
  registry,
  hub,
  deviceId,
  limit = 20,
}) {
  const entries = [];

  for (const repair of hub?.repairs?.recentCompleted ?? []) {
    pushEntry(entries, {
      id: `service.completed:${repair.id}`,
      type: 'service.completed',
      occurredAt: toIso(repair.completedAt),
      summary: repair.title || 'Service completed',
      source: 'service_records',
      refs: {
        serviceRecordId: repair.id,
        workOrderNumber: repair.workOrderNumber ?? null,
      },
    });
  }

  for (const wo of hub?.maintenance?.workOrders?.active ?? []) {
    pushEntry(entries, {
      id: `work_order.created:${wo.id}`,
      type: 'work_order.created',
      occurredAt: toIso(wo.createdAt || wo.updatedAt),
      summary: wo.title || 'Work order opened',
      source: 'service_records',
      refs: {
        serviceRecordId: wo.id,
        workOrderNumber: wo.workOrderNumber ?? null,
        status: wo.status,
      },
    });
  }

  if (deviceId != null) {
    const refuels = await findCompletedRefuelsByVehicleId(Number(deviceId), 10);
    for (const row of refuels) {
      const litres = Number(row.actualFuelLitres);
      pushEntry(entries, {
        id: `fuel.dispensed:${row.id}`,
        type: 'fuel.dispensed',
        occurredAt: toIso(row.sessionDate),
        summary: Number.isFinite(litres) ? `${litres.toFixed(1)} L refuel` : 'Fuel dispensed',
        source: 'operation_refuels',
        refs: {
          refuelId: row.id,
          sessionId: row.sessionId,
          mileageKm: row.currentMileage != null ? Number(row.currentMileage) : null,
        },
      });
    }
  }

  const assignedAt = registry?.assignment?.assignedAt;
  if (assignedAt && registry?.assignment?.deviceId != null) {
    pushEntry(entries, {
      id: `tracker.assigned:${registry.assignment.deviceId}`,
      type: 'tracker.assigned',
      occurredAt: toIso(assignedAt),
      summary: 'Tracker assigned',
      source: 'device_assignments',
      refs: {
        deviceId: registry.assignment.deviceId,
      },
    });
  }

  entries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const seen = new Set();
  const deduped = [];
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    deduped.push(entry);
    if (deduped.length >= limit) break;
  }

  return deduped;
}
