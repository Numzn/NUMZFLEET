import { useState } from 'react';
import { fetchDriverVehicles } from './personApi';
import { useEffectAsync } from '../../../reactHelper';

/**
 * Which vehicle(s) this driver is currently assigned to — the authoritative
 * NUMZFLEET driver_assignments relationship (GET /api/drivers/:id/vehicles),
 * the same one Vehicle Setup's Driver Assignment module writes to. Not
 * derived from live Traccar telemetry: a driver's People profile must agree
 * with what Setup just saved immediately, not wait for the physical device
 * to next report a matching driverUniqueId.
 */
export default function usePersonVehicles(driver, currentUser) {
  const [vehicles, setVehicles] = useState([]);

  useEffectAsync(async () => {
    if (!driver?.id) {
      setVehicles([]);
      return null;
    }
    try {
      const rows = await fetchDriverVehicles(driver.id, currentUser);
      setVehicles(Array.isArray(rows) ? rows.map((v) => ({ ...v, fleetVehicleId: v.id })) : []);
    } catch {
      setVehicles([]);
    }
    return null;
  }, [driver?.id, currentUser]);

  return vehicles;
}
