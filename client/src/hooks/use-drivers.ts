import { useCollection } from "./use-firebase-store"
import { useToast } from "./use-toast"

export interface Driver {
  id: string
  name: string
  licenseNumber: string
  phoneNumber: string
  email: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export function useDrivers() {
  return useCollection<Driver>("drivers", { orderByField: "name" })
}

export function useDriver(id: string) {
  const { data, isLoading } = useCollection<Driver>("drivers", {
    where: [["id", "==", id]],
  })

  return {
    data: data?.[0] as Driver | undefined,
    isLoading,
  }
}

export function useCreateDriver() {
  const { addItem } = useCollection("drivers")
  const { toast } = useToast()

  const createDriver = async (driver: Omit<Driver, "id">) => {
    try {
      const newDriver = await addItem(driver)
      toast({
        title: "Success",
        description: `${driver.name} has been added as a driver.`,
      })
      return newDriver
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add driver. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  return { createDriver }
}

export function useUpdateDriver() {
  const { updateItem } = useCollection("drivers")
  const { toast } = useToast()

  const updateDriver = async (id: string, updates: Partial<Driver>) => {
    try {
      await updateItem(id, updates)
      toast({
        title: "Success",
        description: "Driver information has been updated.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update driver. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  return { updateDriver }
}

export function useDeleteDriver() {
  const { deleteItem } = useCollection("drivers")
  const { toast } = useToast()

  const deleteDriver = async (id: string) => {
    try {
      await deleteItem(id)
      toast({
        title: "Success",
        description: "Driver has been removed from the system.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete driver. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  return { deleteDriver }
}