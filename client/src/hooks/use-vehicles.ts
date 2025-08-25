import { useCollection } from "./use-firebase-store"
import { useToast } from "./use-toast"
import type { Vehicle } from "@shared/schema"
import { addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { db, withFirestoreRetry } from "@/lib/firebase"
import { collections } from "@/lib/firebase"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export function useVehicles() {
  return useCollection<Vehicle>("vehicles", { orderByField: "name" })
}

export function useVehicle(id: string) {
  const { data, isLoading } = useCollection<Vehicle>("vehicles", {
    where: [["id", "==", id]],
  })

  return {
    data: data?.[0],
    isLoading,
  }
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createVehicle = async (vehicle: Omit<Vehicle, "id">) => {
    try {
      // Add timestamp fields
      const vehicleWithTimestamp = {
        ...vehicle,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      }

      // Add to Firestore
      const docRef = await withFirestoreRetry(async () => {
        return await addDoc(collections.vehicles, vehicleWithTimestamp);
      });
      
      // Return the newly created vehicle with its ID
      const newVehicle = {
        id: docRef.id,
        ...vehicleWithTimestamp,
      }

      toast({
        title: "Success",
        description: `${vehicle.name} has been added to the fleet.`,
      })

      return newVehicle
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add vehicle. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  return useMutation({
    mutationFn: createVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
    },
  })
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<Vehicle> }) => {
      try {
        await withFirestoreRetry(async () => {
          const vehicleRef = doc(db, "vehicles", id)
          
          // Add updated timestamp
          const updatesWithTimestamp = {
            ...updates,
            updatedAt: new Date().toISOString(),
          }

          await updateDoc(vehicleRef, updatesWithTimestamp);
        });

        toast({
          title: "Success",
          description: "Vehicle has been updated.",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update vehicle. Please try again.",
          variant: "destructive",
        })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
    },
  })
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await withFirestoreRetry(async () => {
          const vehicleRef = doc(db, "vehicles", id);
          await deleteDoc(vehicleRef);
        });

        toast({
          title: "Success",
          description: "Vehicle has been deleted.",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete vehicle. Please try again.",
          variant: "destructive",
        })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
    },
  })
}
