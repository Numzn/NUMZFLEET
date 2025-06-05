import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import type { Vehicle, InsertVehicle } from "@shared/schema"
import { useToast } from "@/hooks/use-toast"

export function useVehicles() {
  return useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  })
}

export function useVehicle(id: number) {
  return useQuery<Vehicle>({
    queryKey: ["/api/vehicles", id],
    enabled: !!id,
  })
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (vehicle: InsertVehicle) => {
      const response = await apiRequest("POST", "/api/vehicles", vehicle)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] })
      toast({
        title: "Success",
        description: "Vehicle added successfully.",
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
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<InsertVehicle> }) => {
      const response = await apiRequest("PATCH", `/api/vehicles/${id}`, updates)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] })
      toast({
        title: "Success",
        description: "Vehicle updated successfully.",
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
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/vehicles/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] })
      toast({
        title: "Success",
        description: "Vehicle deleted successfully.",
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
    mutationFn: async (updates: Array<{ id: number; updates: Partial<InsertVehicle> }>) => {
      const response = await apiRequest("PATCH", "/api/vehicles/bulk", updates)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] })
      toast({
        title: "Success",
        description: "Vehicles updated successfully.",
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
      const response = await fetch("/api/export/csv")
      if (!response.ok) {
        throw new Error("Failed to export data")
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `fuel-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "CSV file downloaded successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to export data.",
        variant: "destructive",
      })
    },
  })
}
