import type { Driver, Vehicle, FuelRecord, Session } from "@shared/schema"

const STORAGE_KEYS = {
  DRIVERS: 'fleet-fuel-drivers',
  VEHICLES: 'fleet-fuel-vehicles',
  FUEL_RECORDS: 'fleet-fuel-records',
  SESSIONS: 'fleet-fuel-sessions',
  NEXT_IDS: 'fleet-fuel-next-ids'
}

interface NextIds {
  drivers: number
  vehicles: number
  fuelRecords: number
  sessions: number
}

class LocalStorageManager {
  private getNextIds(): NextIds {
    const stored = localStorage.getItem(STORAGE_KEYS.NEXT_IDS)
    return stored ? JSON.parse(stored) : { drivers: 1, vehicles: 1, fuelRecords: 1, sessions: 1 }
  }

  private updateNextIds(nextIds: NextIds): void {
    localStorage.setItem(STORAGE_KEYS.NEXT_IDS, JSON.stringify(nextIds))
  }

  private getNextId(type: keyof NextIds): number {
    const nextIds = this.getNextIds()
    const id = nextIds[type]
    nextIds[type] = id + 1
    this.updateNextIds(nextIds)
    return id
  }

  // Drivers
  getDrivers(): Driver[] {
    const stored = localStorage.getItem(STORAGE_KEYS.DRIVERS)
    return stored ? JSON.parse(stored) : []
  }

  getDriver(id: string): Driver | undefined {
    return this.getDrivers().find(d => d.id === id)
  }

  createDriver(driver: Omit<Driver, 'id' | 'createdAt' | 'updatedAt'>): Driver {
    const newDriver: Driver = {
      ...driver,
      id: this.getNextId('drivers').toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    const drivers = this.getDrivers()
    drivers.push(newDriver)
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers))
    return newDriver
  }

  updateDriver(id: string, updates: Partial<Omit<Driver, 'id' | 'createdAt'>>): Driver | undefined {
    const drivers = this.getDrivers()
    const index = drivers.findIndex(d => d.id === id)
    
    if (index === -1) return undefined
    
    drivers[index] = {
      ...drivers[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers))
    return drivers[index]
  }

  deleteDriver(id: string): boolean {
    const drivers = this.getDrivers()
    const filtered = drivers.filter(d => d.id !== id)
    
    if (filtered.length === drivers.length) return false
    
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(filtered))
    return true
  }

  // Vehicles
  getVehicles(): Vehicle[] {
    const stored = localStorage.getItem(STORAGE_KEYS.VEHICLES)
    return stored ? JSON.parse(stored) : []
  }

  getVehicle(id: string): Vehicle | undefined {
    return this.getVehicles().find(v => v.id === id)
  }

  createVehicle(vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Vehicle {
    const newVehicle: Vehicle = {
      ...vehicle,
      id: this.getNextId('vehicles').toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    const vehicles = this.getVehicles()
    vehicles.push(newVehicle)
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles))
    return newVehicle
  }

  updateVehicle(id: string, updates: Partial<Omit<Vehicle, 'id' | 'createdAt'>>): Vehicle | undefined {
    const vehicles = this.getVehicles()
    const index = vehicles.findIndex(v => v.id === id)
    
    if (index === -1) return undefined
    
    vehicles[index] = {
      ...vehicles[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles))
    return vehicles[index]
  }

  deleteVehicle(id: string): boolean {
    const vehicles = this.getVehicles()
    const filtered = vehicles.filter(v => v.id !== id)
    
    if (filtered.length === vehicles.length) return false
    
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(filtered))
    return true
  }

  // Fuel Records
  getFuelRecords(): FuelRecord[] {
    const stored = localStorage.getItem(STORAGE_KEYS.FUEL_RECORDS)
    return stored ? JSON.parse(stored) : []
  }

  getFuelRecord(id: string): FuelRecord | undefined {
    return this.getFuelRecords().find(r => r.id === id)
  }

  getFuelRecordsByVehicle(vehicleId: string): FuelRecord[] {
    return this.getFuelRecords().filter(r => r.vehicleId === vehicleId)
  }

  createFuelRecord(record: Omit<FuelRecord, 'id' | 'createdAt'>): FuelRecord {
    const newRecord: FuelRecord = {
      ...record,
      id: this.getNextId('fuelRecords').toString(),
      createdAt: new Date().toISOString()
    }
    
    const records = this.getFuelRecords()
    records.push(newRecord)
    localStorage.setItem(STORAGE_KEYS.FUEL_RECORDS, JSON.stringify(records))
    return newRecord
  }

  updateFuelRecord(id: string, updates: Partial<Omit<FuelRecord, 'id' | 'createdAt'>>): FuelRecord | undefined {
    const records = this.getFuelRecords()
    const index = records.findIndex(r => r.id === id)
    
    if (index === -1) return undefined
    
    records[index] = {
      ...records[index],
      ...updates
    }
    
    localStorage.setItem(STORAGE_KEYS.FUEL_RECORDS, JSON.stringify(records))
    return records[index]
  }

  deleteFuelRecord(id: string): boolean {
    const records = this.getFuelRecords()
    const filtered = records.filter(r => r.id !== id)
    
    if (filtered.length === records.length) return false
    
    localStorage.setItem(STORAGE_KEYS.FUEL_RECORDS, JSON.stringify(filtered))
    return true
  }

  // Sessions
  getSessions(): Session[] {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    return stored ? JSON.parse(stored) : []
  }

  getSession(id: string): Session | undefined {
    return this.getSessions().find(s => s.id === id)
  }

  getSessionByDate(date: string): Session | undefined {
    return this.getSessions().find(s => s.date === date)
  }

  createSession(session: Omit<Session, 'id' | 'createdAt'>): Session {
    const newSession: Session = {
      ...session,
      id: this.getNextId('sessions').toString(),
      createdAt: new Date().toISOString()
    }
    
    const sessions = this.getSessions()
    sessions.push(newSession)
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
    return newSession
  }

  updateSession(id: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>): Session | undefined {
    const sessions = this.getSessions()
    const index = sessions.findIndex(s => s.id === id)
    
    if (index === -1) return undefined
    
    sessions[index] = {
      ...sessions[index],
      ...updates
    }
    
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
    return sessions[index]
  }

  deleteSession(id: string): boolean {
    const sessions = this.getSessions()
    const filtered = sessions.filter(s => s.id !== id)
    
    if (filtered.length === sessions.length) return false
    
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(filtered))
    return true
  }

  // Initialize with sample data
  initializeSampleData(): void {
    if (this.getVehicles().length === 0) {
      // Sample drivers
      this.createDriver({
        name: "John Smith",
        licenseNumber: "DL123456",
        phoneNumber: "+1-555-0123",
        email: "john.smith@company.com",
        isActive: true
      })

      this.createDriver({
        name: "Sarah Johnson",
        licenseNumber: "DL789012",
        phoneNumber: "+1-555-0456",
        email: "sarah.johnson@company.com",
        isActive: true
      })

      // Sample vehicles
      this.createVehicle({
        name: "Mark X",
        model: "Mark X",
        type: "sedan",
        registrationNumber: "ABC-123",
        plateNumber: "ABC-123",
        fuelType: "petrol",
        fuelCapacity: 60,
        currentMileage: 25000,
        budget: 500,
        actual: 0,
        attendant: "",
        pump: "",
        driverId: "1",
        isActive: true
      })

      this.createVehicle({
        name: "Hilux",
        model: "Hilux",
        type: "truck",
        registrationNumber: "XYZ-789",
        plateNumber: "XYZ-789",
        fuelType: "diesel",
        fuelCapacity: 80,
        currentMileage: 45000,
        budget: 800,
        actual: 0,
        attendant: "",
        pump: "",
        driverId: "2",
        isActive: true
      })

      this.createVehicle({
        name: "Corolla",
        model: "Corolla",
        type: "sedan",
        registrationNumber: "DEF-456",
        plateNumber: "DEF-456",
        fuelType: "petrol",
        fuelCapacity: 50,
        currentMileage: 15000,
        budget: 400,
        actual: 0,
        attendant: "",
        pump: "",
        driverId: undefined,
        isActive: true
      })
    }
  }

  // Export data
  exportToCSV(): string {
    const vehicles = this.getVehicles()
    const drivers = this.getDrivers()
    const fuelRecords = this.getFuelRecords()
    
    const csvRows = [
      'Vehicle,Driver,Plate,Type,Budget,Actual,Variance,Fuel Records'
    ]
    
    vehicles.forEach(vehicle => {
      const driver = drivers.find(d => d.id === vehicle.driverId)
      const vehicleFuelRecords = fuelRecords.filter(r => r.vehicleId === vehicle.id)
      const variance = (vehicle.actual || 0) - vehicle.budget
      
      csvRows.push([
        vehicle.name,
        driver?.name || 'No driver',
        vehicle.plateNumber || 'No plate',
        vehicle.type,
        vehicle.budget.toString(),
        (vehicle.actual || 0).toString(),
        variance.toString(),
        vehicleFuelRecords.length.toString()
      ].join(','))
    })
    
    return csvRows.join('\n')
  }

  // Clear all data
  clearAllData(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
  }
}

export const localStorageManager = new LocalStorageManager()