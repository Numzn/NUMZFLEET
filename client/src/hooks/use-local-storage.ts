import { useState, useEffect } from "react"
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query"
import { localStorageManager } from "@/lib/localStorage"
import { useToast } from "@/hooks/use-toast"
import type { Driver, Vehicle, FuelRecord, Session, InsertDriver, InsertVehicle, InsertFuelRecord } from "@shared/schema"

// Initialize sample data on first load
localStorageManager.initializeSampleData()

// Drivers hooks
export function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: () => localStorageManager.getDrivers(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: ['drivers', id],
    queryFn: () => localStorageManager.getDriver(id),
    enabled: !!id,
  })
}

export function useCreateDriver() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (driver: InsertDriver) => {
      return localStorageManager.createDriver(driver)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      toast({
        title: "Driver Added",
        description: "New driver has been added successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add driver.",
        variant: "destructive",
      })
    },
  })
}

export function useUpdateDriver() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertDriver> }) => {
      const updated = localStorageManager.updateDriver(id, updates)
      if (!updated) throw new Error("Driver not found")
      return updated
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      toast({
        title: "Driver Updated",
        description: "Driver information has been updated successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update driver.",
        variant: "destructive",
      })
    },
  })
}

export function useDeleteDriver() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const deleted = localStorageManager.deleteDriver(id)
      if (!deleted) throw new Error("Driver not found")
      return deleted
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      toast({
        title: "Driver Deleted",
        description: "Driver has been removed successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete driver.",
        variant: "destructive",
      })
    },
  })
}

// Vehicles hooks
export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: () => localStorageManager.getVehicles(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: ['vehicles', id],
    queryFn: () => localStorageManager.getVehicle(id),
    enabled: !!id,
  })
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (vehicle: InsertVehicle) => {
      return localStorageManager.createVehicle(vehicle)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast({
        title: "Vehicle Added",
        description: "New vehicle has been added successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add vehicle.",
        variant: "destructive",
      })
    },
  })
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertVehicle> }) => {
      const updated = localStorageManager.updateVehicle(id, updates)
      if (!updated) throw new Error("Vehicle not found")
      return updated
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast({
        title: "Vehicle Updated",
        description: "Vehicle information has been updated successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vehicle.",
        variant: "destructive",
      })
    },
  })
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const deleted = localStorageManager.deleteVehicle(id)
      if (!deleted) throw new Error("Vehicle not found")
      return deleted
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast({
        title: "Vehicle Deleted",
        description: "Vehicle has been removed successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete vehicle.",
        variant: "destructive",
      })
    },
  })
}

export function useBulkUpdateVehicles() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (updates: Array<{ id: string; updates: Partial<InsertVehicle> }>) => {
      const results = updates.map(({ id, updates: vehicleUpdates }) => 
        localStorageManager.updateVehicle(id, vehicleUpdates)
      )
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast({
        title: "Vehicles Updated",
        description: "All vehicle data has been saved successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vehicles.",
        variant: "destructive",
      })
    },
  })
}

export function useExportCSV() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: async () => {
      const csvData = localStorageManager.exportToCSV()
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fleet-data-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      return csvData
    },
    onSuccess: () => {
      toast({
        title: "Export Complete",
        description: "Fleet data has been exported successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data.",
        variant: "destructive",
      })
    },
  })
}

// Fuel Records hooks
export function useFuelRecords() {
  return useQuery({
    queryKey: ['fuel-records'],
    queryFn: () => localStorageManager.getFuelRecords(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useFuelRecordsByVehicle(vehicleId: string) {
  return useQuery({
    queryKey: ['fuel-records', 'vehicle', vehicleId],
    queryFn: () => localStorageManager.getFuelRecordsByVehicle(vehicleId),
    enabled: !!vehicleId,
  })
}

export function useCreateFuelRecord() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (record: InsertFuelRecord) => {
      return localStorageManager.createFuelRecord(record)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-records'] })
      toast({
        title: "Fuel Record Added",
        description: "New fuel record has been saved successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add fuel record.",
        variant: "destructive",
      })
    },
  })
}

// Sessions hooks
export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => localStorageManager.getSessions(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useCreateSession() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (session: Omit<Session, 'id' | 'createdAt'>) => {
      return localStorageManager.createSession(session)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast({
        title: "Session Saved",
        description: "Fuel session has been saved successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save session.",
        variant: "destructive",
      })
    },
  })
}