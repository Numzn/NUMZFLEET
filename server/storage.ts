import { vehicles, sessions, type Vehicle, type InsertVehicle, type Session, type InsertSession } from "@shared/schema";

export interface IStorage {
  // Vehicle operations
  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<boolean>;
  
  // Session operations
  getSessions(): Promise<Session[]>;
  getSession(id: number): Promise<Session | undefined>;
  getSessionByDate(date: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: number, updates: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private vehicles: Map<number, Vehicle>;
  private sessions: Map<number, Session>;
  private currentVehicleId: number;
  private currentSessionId: number;

  constructor() {
    this.vehicles = new Map();
    this.sessions = new Map();
    this.currentVehicleId = 1;
    this.currentSessionId = 1;
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const sampleVehicles: Vehicle[] = [
      {
        id: 1,
        name: "Mark X",
        type: "sedan",
        plateNumber: "ABC-123-XY",
        budget: 1850,
        actual: 0,
        attendant: "",
        pump: "",
        fuelType: "petrol",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        name: "Toyota Vitz",
        type: "compact",
        plateNumber: "DEF-456-YZ",
        budget: 1200,
        actual: 0,
        attendant: "",
        pump: "",
        fuelType: "petrol",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        name: "Honda Fit",
        type: "hatchback",
        plateNumber: "GHI-789-ZA",
        budget: 1800,
        actual: 0,
        attendant: "",
        pump: "",
        fuelType: "petrol",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    sampleVehicles.forEach(vehicle => {
      this.vehicles.set(vehicle.id, vehicle);
    });
    this.currentVehicleId = 4;
  }

  // Vehicle operations
  async getVehicles(): Promise<Vehicle[]> {
    return Array.from(this.vehicles.values()).filter(v => v.isActive);
  }

  async getVehicle(id: number): Promise<Vehicle | undefined> {
    return this.vehicles.get(id);
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const id = this.currentVehicleId++;
    const vehicle: Vehicle = {
      ...insertVehicle,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.vehicles.set(id, vehicle);
    return vehicle;
  }

  async updateVehicle(id: number, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return undefined;

    const updatedVehicle: Vehicle = {
      ...vehicle,
      ...updates,
      updatedAt: new Date(),
    };
    this.vehicles.set(id, updatedVehicle);
    return updatedVehicle;
  }

  async deleteVehicle(id: number): Promise<boolean> {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return false;

    const updatedVehicle: Vehicle = {
      ...vehicle,
      isActive: false,
      updatedAt: new Date(),
    };
    this.vehicles.set(id, updatedVehicle);
    return true;
  }

  // Session operations
  async getSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async getSession(id: number): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getSessionByDate(date: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(s => s.date === date);
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = this.currentSessionId++;
    const session: Session = {
      ...insertSession,
      id,
      createdAt: new Date(),
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(id: number, updates: Partial<InsertSession>): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const updatedSession: Session = {
      ...session,
      ...updates,
    };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteSession(id: number): Promise<boolean> {
    return this.sessions.delete(id);
  }
}

export const storage = new MemStorage();
