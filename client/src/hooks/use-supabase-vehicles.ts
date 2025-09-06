import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Vehicle = Database['public']['Tables']['vehicles']['Row']
type VehicleInsert = Database['public']['Tables']['vehicles']['Insert']
type VehicleUpdate = Database['public']['Tables']['vehicles']['Update']

// Fetch all vehicles
export const useVehicles = () => {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async (): Promise<Vehicle[]> => {
      console.log('🔍 Fetching vehicles from Supabase...');
      try {
        console.log('🔍 Step 1: About to query vehicles table...');
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .eq('is_active', true)
          .order('name');

        console.log('🔍 Step 2: Query completed, checking for errors...');
        if (error) {
          console.error('❌ Error fetching vehicles:', error);
          console.error('❌ Error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          throw error;
        }

        console.log('✅ Vehicles fetched successfully:', data?.length || 0, 'vehicles');
        console.log('✅ Sample vehicle data:', data?.[0] || 'No vehicles found');
        return data || [];
      } catch (err) {
        console.error('❌ Exception in vehicles query:', err);
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 1,
    retryDelay: 1000, // 1 second delay
  })
}

// Create a new vehicle
export const useCreateVehicle = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vehicle: VehicleInsert): Promise<Vehicle> => {
      // Transform camelCase to snake_case for database
      const dbVehicle = {
        name: vehicle.name,
        model: vehicle.model,
        type: vehicle.type,
        registration_number: vehicle.registrationNumber,
        driver_id: vehicle.driverId,
        budget: vehicle.budget,
        fuel_type: vehicle.fuelType,
        fuel_capacity: vehicle.fuelCapacity,
        current_mileage: vehicle.currentMileage,
        is_active: vehicle.isActive,
        traccar_device_id: vehicle.traccarDeviceId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      console.log('🔍 Creating vehicle with data:', dbVehicle);

      const { data, error } = await supabase
        .from('vehicles')
        .insert(dbVehicle)
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating vehicle:', error)
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        throw error
      }

      console.log('✅ Vehicle created successfully:', data)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

// Update a vehicle
export const useUpdateVehicle = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: VehicleUpdate }): Promise<Vehicle> => {
      // Transform camelCase to snake_case for database
      const dbUpdates: any = {}
      
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.model !== undefined) dbUpdates.model = updates.model
      if (updates.type !== undefined) dbUpdates.type = updates.type
      if (updates.registrationNumber !== undefined) dbUpdates.registration_number = updates.registrationNumber
      if (updates.driverId !== undefined) dbUpdates.driver_id = updates.driverId
      if (updates.budget !== undefined) dbUpdates.budget = updates.budget
      if (updates.fuelType !== undefined) dbUpdates.fuel_type = updates.fuelType
      if (updates.fuelCapacity !== undefined) dbUpdates.fuel_capacity = updates.fuelCapacity
      if (updates.currentMileage !== undefined) dbUpdates.current_mileage = updates.currentMileage
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive
      if (updates.traccarDeviceId !== undefined) dbUpdates.traccar_device_id = updates.traccarDeviceId
      
      dbUpdates.updated_at = new Date().toISOString()

      console.log('🔍 Updating vehicle with data:', dbUpdates);

      const { data, error } = await supabase
        .from('vehicles')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('❌ Error updating vehicle:', error)
        throw error
      }

      console.log('✅ Vehicle updated successfully:', data)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

// Delete a vehicle (soft delete)
export const useDeleteVehicle = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('vehicles')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) {
        console.error('❌ Error deleting vehicle:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

// Get a single vehicle by ID
export const useVehicle = (id: string) => {
  return useQuery({
    queryKey: ['vehicles', id],
    queryFn: async (): Promise<Vehicle | null> => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching vehicle:', error)
        throw error
      }

      return data
    },
    enabled: !!id,
  })
}
