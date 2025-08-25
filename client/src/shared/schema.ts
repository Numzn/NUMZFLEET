export interface Vehicle {
  id: string;
  name: string;
  regNumber: string;
  type: string;
  budget: number;
  fuelEfficiency?: number;
}

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  assignedVehicleId?: string;
}

export interface FuelRecord {
  id: string;
  vehicleId: string;
  date: string;
  liters: number;
  totalCost: number;
  kilometers: number;
  driverId?: string;
  notes?: string;
}
