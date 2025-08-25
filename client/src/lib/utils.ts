import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculates average fuel efficiency for a vehicle.
 * If mileage data is available, returns liters per 100km.
 * If not, returns average liters per month.
 * @param fuelRecords Array of fuel records for a vehicle, sorted by sessionDate ascending
 * @returns { efficiency: number | null, type: 'L/100km' | 'L/month' | null }
 */
export function calculateFuelEfficiency(fuelRecords: { fuelAmount: number; currentMileage?: number; sessionDate: string }[]): { efficiency: number | null, type: 'L/100km' | 'L/month' | null } {
  if (!fuelRecords || fuelRecords.length < 2) {
    return { efficiency: null, type: null };
  }

  // Try to calculate L/100km if mileage is available
  const recordsWithMileage = fuelRecords.filter(r => typeof r.currentMileage === 'number');
  if (recordsWithMileage.length >= 2) {
    // Sort by date
    const sorted = [...recordsWithMileage].sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const distance = (last.currentMileage! - first.currentMileage!);
    const totalFuel = sorted.slice(1).reduce((sum, r) => sum + r.fuelAmount, 0); // exclude first fill-up
    if (distance > 0 && totalFuel > 0) {
      const efficiency = (totalFuel / distance) * 100; // L/100km
      return { efficiency, type: 'L/100km' };
    }
  }

  // Fallback: average liters per month
  const sorted = [...fuelRecords].sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());
  const firstDate = new Date(sorted[0].sessionDate);
  const lastDate = new Date(sorted[sorted.length - 1].sessionDate);
  const months = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + (lastDate.getMonth() - firstDate.getMonth()) + 1;
  const totalFuel = fuelRecords.reduce((sum, r) => sum + r.fuelAmount, 0);
  if (months > 0 && totalFuel > 0) {
    const efficiency = totalFuel / months;
    return { efficiency, type: 'L/month' };
  }

  return { efficiency: null, type: null };
}
