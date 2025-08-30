import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type FuelRecord = Database['public']['Tables']['fuel_records']['Row']
type FuelRecordInsert = Database['public']['Tables']['fuel_records']['Insert']
type FuelRecordUpdate = Database['public']['Tables']['fuel_records']['Update']

// Fetch all fuel records
export const useFuelRecords = () => {
  return useQuery({
    queryKey: ['fuel-records'],
    queryFn: async (): Promise<FuelRecord[]> => {
      const { data, error } = await supabase
        .from('fuel_records')
        .select('*')
        .order('session_date', { ascending: false })

      if (error) {
        console.error('Error fetching fuel records:', error)
        throw error
      }

      return data || []
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  })
}

// Create a new fuel record
export const useCreateFuelRecord = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fuelRecord: FuelRecordInsert): Promise<FuelRecord> => {
      const { data, error } = await supabase
        .from('fuel_records')
        .insert({
          ...fuelRecord,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating fuel record:', error)
        throw error
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-records'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] }) // Update vehicle mileage
    },
  })
}

// Update a fuel record
export const useUpdateFuelRecord = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: FuelRecordUpdate }): Promise<FuelRecord> => {
      const { data, error } = await supabase
        .from('fuel_records')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating fuel record:', error)
        throw error
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-records'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

// Delete a fuel record
export const useDeleteFuelRecord = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('fuel_records')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting fuel record:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-records'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

// Get fuel records for a specific vehicle
export const useVehicleFuelRecords = (vehicleId: string) => {
  return useQuery({
    queryKey: ['fuel-records', 'vehicle', vehicleId],
    queryFn: async (): Promise<FuelRecord[]> => {
      const { data, error } = await supabase
        .from('fuel_records')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('session_date', { ascending: false })

      if (error) {
        console.error('Error fetching vehicle fuel records:', error)
        throw error
      }

      return data || []
    },
    enabled: !!vehicleId,
  })
}

// Get fuel records for a date range
export const useFuelRecordsByDateRange = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['fuel-records', 'date-range', startDate, endDate],
    queryFn: async (): Promise<FuelRecord[]> => {
      const { data, error } = await supabase
        .from('fuel_records')
        .select('*')
        .gte('session_date', startDate)
        .lte('session_date', endDate)
        .order('session_date', { ascending: false })

      if (error) {
        console.error('Error fetching fuel records by date range:', error)
        throw error
      }

      return data || []
    },
    enabled: !!startDate && !!endDate,
  })
}
