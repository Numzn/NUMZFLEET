import { pgTable, text, serial, integer, boolean, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  licenseNumber: text("license_number"),
  phoneNumber: text("phone_number"),
  email: text("email"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("sedan"),
  plateNumber: text("plate_number"),
  budget: real("budget").notNull(),
  actual: real("actual").default(0),
  attendant: text("attendant").default(""),
  pump: text("pump").default(""),
  fuelType: text("fuel_type").default("petrol"),
  fuelCapacity: real("fuel_capacity").default(50),
  currentMileage: real("current_mileage").default(0),
  driverId: integer("driver_id").references(() => drivers.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fuelRecords = pgTable("fuel_records", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  driverId: integer("driver_id").references(() => drivers.id),
  sessionDate: text("session_date").notNull(),
  previousMileage: real("previous_mileage").notNull(),
  currentMileage: real("current_mileage").notNull(),
  distanceTraveled: real("distance_traveled").notNull(),
  fuelAmount: real("fuel_amount").notNull(),
  fuelCost: real("fuel_cost").notNull(),
  fuelEfficiency: real("fuel_efficiency"),
  attendant: text("attendant"),
  pumpNumber: text("pump_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  excessAllocation: text("excess_allocation").default(""),
  totalBudget: real("total_budget").notNull(),
  totalActual: real("total_actual").notNull(),
  vehicleData: jsonb("vehicle_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDriverSchema = createInsertSchema(drivers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFuelRecordSchema = createInsertSchema(fuelRecords).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type FuelRecord = typeof fuelRecords.$inferSelect;
export type InsertFuelRecord = z.infer<typeof insertFuelRecordSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
