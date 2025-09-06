// TypeScript interfaces for Supabase tables
export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  phoneNumber: string;
  email: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  model: string;
  type: string;
  registrationNumber: string;
  plateNumber?: string; // Add missing property
  driverId?: string;
  budget: number;
  currentMileage?: number;
  fuelType?: string;
  fuelCapacity?: number;
  actual?: number;
  isActive?: boolean;
  attendant?: string; // Add missing property
  pump?: string; // Add missing property
  createdAt?: string;
  updatedAt?: string;
  // GPS TRACKING FIELDS
  traccarDeviceId?: string;
  lastLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
    speed?: number;
    heading?: number;
    altitude?: number;
  };
  isOnline?: boolean;
  lastUpdate?: string;
}

export interface FuelRecord {
  id: string;
  vehicleId: string;
  sessionDate: string;
  fuelAmount: number;
  fuelCost: number;
  currentMileage?: number;
  fuelEfficiency?: number;
  attendant?: string;
  pumpNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Session {
  id: string;
  date: string;
  vehicles: Vehicle[];
  totalBudget: number;
  totalActual: number;
  excessAllocation?: string;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
}

// Traccar-specific type definitions
export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline';
  lastUpdate?: string;
  positionId?: number;
  groupId?: number;
  phone?: string;
  model?: string;
  contact?: string;
  category?: string;
  disabled?: boolean;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  protocol: string;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address?: string;
  accuracy?: number;
  network?: any;
}

// Import zod for validation
import { z } from 'zod';

// Validation schemas
export const insertDriverSchema = z.object({
  name: z.string().min(1, "Name is required"),
  licenseNumber: z.string().min(1, "License number is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address"),
  isActive: z.boolean().optional(),
});

export const insertVehicleSchema = z.object({
  name: z.string().min(1, "Vehicle name is required"),
  model: z.string().min(1, "Model is required"),
  type: z.string().min(1, "Type is required"),
  registrationNumber: z.string().min(1, "Registration number is required"),
  plateNumber: z.string().optional(), // Add missing property
  driverId: z.string().optional(),
  budget: z.number().min(0, "Budget must be a positive number"),
  fuelType: z.string().optional(),
  fuelCapacity: z.number().optional(),
  currentMileage: z.number().optional(),
  actual: z.number().optional(),
  isActive: z.boolean().optional(),
  attendant: z.string().optional(), // Add missing property
  pump: z.string().optional(), // Add missing property
  // GPS TRACKING FIELDS
  traccarDeviceId: z.string().optional(),
  lastLocation: z.object({
    lat: z.number(),
    lng: z.number(),
    timestamp: z.string(),
    speed: z.number().optional(),
    heading: z.number().optional(),
    altitude: z.number().optional(),
  }).optional(),
  isOnline: z.boolean().optional(),
  lastUpdate: z.string().optional(),
});

export const insertFuelRecordSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  sessionDate: z.string().min(1, "Session date is required"),
  fuelAmount: z.number().min(0, "Fuel amount must be a positive number"),
  fuelCost: z.number().min(0, "Fuel cost must be a positive number"),
  currentMileage: z.number().optional(),
  fuelEfficiency: z.number().optional(),
  attendant: z.string().optional(),
  pumpNumber: z.string().optional(),
});

// Collection names as constants
export const COLLECTIONS = {
  drivers: 'drivers',
  vehicles: 'vehicles',
  fuelRecords: 'fuelRecords',
  sessions: 'sessions'
} as const;

// Export the insert types for use in forms
export type InsertDriver = Omit<Driver, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertVehicle = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertFuelRecord = Omit<FuelRecord, 'id' | 'createdAt' | 'updatedAt'>;
