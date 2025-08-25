import { useCollection } from "./use-firebase-store"
import { useToast } from "./use-toast"

export interface FuelRecord {
  id: string
  vehicleId: string
  sessionDate: string
  fuelAmount: number
  fuelCost: number
  currentMileage?: number
  fuelEfficiency?: number
  attendant?: string
  pumpNumber?: string
  createdAt?: string
  updatedAt?: string
}

export function useFuelRecords(limit?: number) {
  return useCollection<FuelRecord>("fuelRecords", {
    limit,
  })
}

export function useFuelRecord(id: string) {
  const { data, isLoading } = useCollection("fuelRecords", {
    where: [["id", "==", id]],
  })

  return {
    data: data?.[0] as FuelRecord | undefined,
    isLoading,
  }
}

export function useVehicleFuelRecords(vehicleId: string, limit?: number) {
  return useCollection("fuelRecords", {
    where: [["vehicleId", "==", vehicleId]],
    limit,
  })
}

export function useCreateFuelRecord() {
  const { addItem } = useCollection("fuelRecords")
  const { toast } = useToast()

  const createFuelRecord = async (record: Omit<FuelRecord, "id">) => {
    try {
      const newRecord = await addItem(record as any)
      toast({
        title: "Success",
        description: "Fuel record has been added successfully.",
      })
      return newRecord
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add fuel record. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  return { createFuelRecord }
}

export function useUpdateFuelRecord() {
  const { updateItem } = useCollection("fuelRecords")
  const { toast } = useToast()

  const updateFuelRecord = async (id: string, updates: Partial<FuelRecord>) => {
    try {
      await updateItem(id, updates)
      toast({
        title: "Success",
        description: "Fuel record has been updated.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update fuel record. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  return { updateFuelRecord }
}

export function useDeleteFuelRecord() {
  const { deleteItem } = useCollection("fuelRecords")
  const { toast } = useToast()

  const deleteFuelRecord = async (id: string) => {
    try {
      await deleteItem(id)
      toast({
        title: "Success",
        description: "Fuel record has been deleted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete fuel record. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  return { deleteFuelRecord }
}