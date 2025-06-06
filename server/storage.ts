import { drivers, vehicles, fuelRecords, sessions, type Driver, type InsertDriver, type Vehicle, type InsertVehicle, type FuelRecord, type InsertFuelRecord, type Session, type InsertSession } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Driver operations
  getDrivers(): Promise<Driver[]>;
  getDriver(id: number): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver): Promise<Driver>;
  updateDriver(id: number, updates: Partial<InsertDriver>): Promise<Driver | undefined>;
  deleteDriver(id: number): Promise<boolean>;
  
  // Vehicle operations
  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<boolean>;
  
  // Fuel record operations
  getFuelRecords(): Promise<FuelRecord[]>;
  getFuelRecord(id: number): Promise<FuelRecord | undefined>;
  getFuelRecordsByVehicle(vehicleId: number): Promise<FuelRecord[]>;
  createFuelRecord(record: InsertFuelRecord): Promise<FuelRecord>;
  updateFuelRecord(id: number, updates: Partial<InsertFuelRecord>): Promise<FuelRecord | undefined>;
  deleteFuelRecord(id: number): Promise<boolean>;
  
  // Session operations
  getSessions(): Promise<Session[]>;
  getSession(id: number): Promise<Session | undefined>;
  getSessionByDate(date: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: number, updates: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Driver operations
  async getDrivers(): Promise<Driver[]> {
    const result = await db.select().from(drivers).where(eq(drivers.isActive, true));
    return result;
  }

  async getDriver(id: number): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver || undefined;
  }

  async createDriver(insertDriver: InsertDriver): Promise<Driver> {
    const [driver] = await db
      .insert(drivers)
      .values(insertDriver)
      .returning();
    return driver;
  }

  async updateDriver(id: number, updates: Partial<InsertDriver>): Promise<Driver | undefined> {
    const [driver] = await db
      .update(drivers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(drivers.id, id))
      .returning();
    return driver || undefined;
  }

  async deleteDriver(id: number): Promise<boolean> {
    const [driver] = await db
      .update(drivers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(drivers.id, id))
      .returning();
    return !!driver;
  }

  // Vehicle operations
  async getVehicles(): Promise<Vehicle[]> {
    const result = await db.select().from(vehicles).where(eq(vehicles.isActive, true));
    return result;
  }

  async getVehicle(id: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle || undefined;
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db
      .insert(vehicles)
      .values(insertVehicle)
      .returning();
    return vehicle;
  }

  async updateVehicle(id: number, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const [vehicle] = await db
      .update(vehicles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();
    return vehicle || undefined;
  }

  async deleteVehicle(id: number): Promise<boolean> {
    const [vehicle] = await db
      .update(vehicles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();
    return !!vehicle;
  }

  // Fuel record operations
  async getFuelRecords(): Promise<FuelRecord[]> {
    const result = await db.select().from(fuelRecords).orderBy(desc(fuelRecords.createdAt));
    return result;
  }

  async getFuelRecord(id: number): Promise<FuelRecord | undefined> {
    const [record] = await db.select().from(fuelRecords).where(eq(fuelRecords.id, id));
    return record || undefined;
  }

  async getFuelRecordsByVehicle(vehicleId: number): Promise<FuelRecord[]> {
    const result = await db
      .select()
      .from(fuelRecords)
      .where(eq(fuelRecords.vehicleId, vehicleId))
      .orderBy(desc(fuelRecords.createdAt));
    return result;
  }

  async createFuelRecord(insertRecord: InsertFuelRecord): Promise<FuelRecord> {
    const [record] = await db
      .insert(fuelRecords)
      .values(insertRecord)
      .returning();
    return record;
  }

  async updateFuelRecord(id: number, updates: Partial<InsertFuelRecord>): Promise<FuelRecord | undefined> {
    const [record] = await db
      .update(fuelRecords)
      .set(updates)
      .where(eq(fuelRecords.id, id))
      .returning();
    return record || undefined;
  }

  async deleteFuelRecord(id: number): Promise<boolean> {
    const result = await db.delete(fuelRecords).where(eq(fuelRecords.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Session operations
  async getSessions(): Promise<Session[]> {
    const result = await db.select().from(sessions).orderBy(desc(sessions.createdAt));
    return result;
  }

  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session || undefined;
  }

  async getSessionByDate(date: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.date, date));
    return session || undefined;
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const [session] = await db
      .insert(sessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async updateSession(id: number, updates: Partial<InsertSession>): Promise<Session | undefined> {
    const [session] = await db
      .update(sessions)
      .set(updates)
      .where(eq(sessions.id, id))
      .returning();
    return session || undefined;
  }

  async deleteSession(id: number): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, id));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
