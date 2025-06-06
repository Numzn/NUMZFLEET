import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import type { FuelRecord, InsertFuelRecord } from "@shared/schema"
import { useToast } from "@/hooks/use-toast"

export function useFuelRecords() {
  return useQuery<FuelRecord[]>({
    queryKey: ["/api/fuel-records"],
  })
}

export function useFuelRecordsByVehicle(vehicleId: number) {
  return useQuery<FuelRecord[]>({
    queryKey: ["/api/fuel-records", "vehicle", vehicleId],
    enabled: !!vehicleId,
  })
}

export function useCreateFuelRecord() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (record: InsertFuelRecord) => {
      const response = await apiRequest("POST", "/api/fuel-records", record)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fuel-records"] })
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] })
      toast({
        title: "Success",
        description: "Fuel record added successfully.",
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