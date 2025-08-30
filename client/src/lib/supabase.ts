import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Database types (these will be generated from your Supabase schema)
export interface Database {
  public: {
    Tables: {
      vehicles: {
        Row: {
          id: string
          name: string
          type: string
          registration_number: string | null
          fuel_type: string | null
          fuel_capacity: number | null
          current_mileage: number | null
          budget: number | null
          driver_id: string | null
          traccar_device_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          registration_number?: string | null
          fuel_type?: string | null
          fuel_capacity?: number | null
          current_mileage?: number | null
          budget?: number | null
          driver_id?: string | null
          traccar_device_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          registration_number?: string | null
          fuel_type?: string | null
          fuel_capacity?: number | null
          current_mileage?: number | null
          budget?: number | null
          driver_id?: string | null
          traccar_device_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      drivers: {
        Row: {
          id: string
          name: string
          license_number: string | null
          phone_number: string | null
          email: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          license_number?: string | null
          phone_number?: string | null
          email?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          license_number?: string | null
          phone_number?: string | null
          email?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      fuel_records: {
        Row: {
          id: string
          vehicle_id: string
          session_date: string
          fuel_amount: number | null
          fuel_cost: number | null
          current_mileage: number | null
          fuel_efficiency: number | null
          attendant: string | null
          pump_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          session_date: string
          fuel_amount?: number | null
          fuel_cost?: number | null
          current_mileage?: number | null
          fuel_efficiency?: number | null
          attendant?: string | null
          pump_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          session_date?: string
          fuel_amount?: number | null
          fuel_cost?: number | null
          current_mileage?: number | null
          fuel_efficiency?: number | null
          attendant?: string | null
          pump_number?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      admins: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'owner'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          role?: 'admin' | 'owner'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'owner'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      system_config: {
        Row: {
          id: string
          key: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Type-safe Supabase client
export type SupabaseClient = typeof supabase
