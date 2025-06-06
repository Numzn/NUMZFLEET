import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import type { Driver, InsertDriver } from "@shared/schema"
import { useToast } from "@/hooks/use-toast"

export function useDrivers() {
  return useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  })
}

export function useDriver(id: number) {
  return useQuery<Driver>({
    queryKey: ["/api/drivers", id],
    enabled: !!id,
  })
}

export function useCreateDriver() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (driver: InsertDriver) => {
      const response = await apiRequest("POST", "/api/drivers", driver)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] })
      toast({
        title: "Success",
        description: "Driver added successfully.",
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
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<InsertDriver> }) => {
      const response = await apiRequest("PATCH", `/api/drivers/${id}`, updates)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] })
      toast({
        title: "Success",
        description: "Driver updated successfully.",
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
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/drivers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] })
      toast({
        title: "Success",
        description: "Driver deleted successfully.",
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