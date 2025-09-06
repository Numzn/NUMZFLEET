import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Driver = Database['public']['Tables']['drivers']['Row']
type DriverInsert = Database['public']['Tables']['drivers']['Insert']
type DriverUpdate = Database['public']['Tables']['drivers']['Update']

// Fetch all drivers
export const useDrivers = () => {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async (): Promise<Driver[]> => {
      console.log('🔍 Fetching drivers from Supabase...');
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) {
          console.error('❌ Error fetching drivers:', error);
          throw error;
        }

        console.log('✅ Drivers fetched successfully:', data?.length || 0, 'drivers');
        return data || [];
      } catch (err) {
        console.error('❌ Exception in drivers query:', err);
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 1,
  })
}

// Create a new driver
export const useCreateDriver = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (driver: DriverInsert): Promise<Driver> => {
      const { data, error } = await supabase
        .from('drivers')
        .insert({
          ...driver,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating driver:', error)
        throw error
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
    },
  })
}

// Update a driver
export const useUpdateDriver = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: DriverUpdate }): Promise<Driver> => {
      const { data, error } = await supabase
        .from('drivers')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating driver:', error)
        throw error
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
    },
  })
}

// Delete a driver (soft delete)
export const useDeleteDriver = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('drivers')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) {
        console.error('Error deleting driver:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
    },
  })
}

// Get a single driver by ID
export const useDriver = (id: string) => {
  return useQuery({
    queryKey: ['drivers', id],
    queryFn: async (): Promise<Driver | null> => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching driver:', error)
        throw error
      }

      return data
    },
    enabled: !!id,
  })
}
