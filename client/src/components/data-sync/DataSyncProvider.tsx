import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSupabase } from '@/hooks/use-supabase';
import { useAuth } from '@/contexts/AuthContext';

interface DataSyncContextType {
  isAutoSyncEnabled: boolean;
  toggleAutoSync: () => void;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  manualSync: () => void;
}

const DataSyncContext = createContext<DataSyncContextType | undefined>(undefined);

export function DataSyncProvider({ children }: { children: React.ReactNode }) {
  // Auto-sync enabled by default for seamless operation
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  const { supabase } = useSupabase();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  // Supabase data sync function
  const performDataSync = async () => {
    // Only sync if user is authenticated and is admin
    if (!user || !isAdmin) {
      console.log('⏸️ Skipping data sync - user not authenticated or not admin');
      return;
    }

    // Additional safety check - prevent sync if already in progress
    if (syncStatus === 'syncing') {
      console.log('⏸️ Skipping data sync - already in progress');
      return;
    }

    try {
      setSyncStatus('syncing');
      console.log('🔄 Syncing data with Supabase...');
      
      // Sync vehicles data
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*');
      
      if (vehiclesError) {
        console.error('❌ Vehicles sync error:', vehiclesError);
        throw vehiclesError;
      }

      // Sync drivers data
      const { data: drivers, error: driversError } = await supabase
        .from('drivers')
        .select('*');
      
      if (driversError) {
        console.error('❌ Drivers sync error:', driversError);
        throw driversError;
      }

      // Sync fuel records data
      const { data: fuelRecords, error: fuelError } = await supabase
        .from('fuel_records')
        .select('*');
      
      if (fuelError) {
        console.error('❌ Fuel records sync error:', fuelError);
        throw fuelError;
      }

      console.log('✅ Data sync completed successfully');
      setSyncStatus('success');
      setLastSyncTime(new Date().toISOString());
      
      // Quick success feedback, then back to idle
      setTimeout(() => setSyncStatus('idle'), 1000);
      
    } catch (error) {
      console.error('❌ Data sync failed:', error);
      setSyncStatus('error');
      
      // Error feedback for a bit longer, then back to idle
      setTimeout(() => setSyncStatus('idle'), 3000);
      
      toast({
        title: "Sync Error",
        description: "Failed to sync data with Supabase",
        variant: "destructive"
      });
    }
  };

  // Auto-sync effect - only run when authenticated
  useEffect(() => {
    // Don't start auto-sync if still loading or not authenticated
    if (!isAutoSyncEnabled || !user || !isAdmin) {
      console.log('⏸️ Auto-sync disabled or user not authenticated');
      return;
    }

    // Additional check - ensure we're not in a loading state
    if (!user || !isAdmin) {
      console.log('⏸️ Auto-sync waiting for authentication to complete');
      return;
    }

    // Only start auto-sync after a delay to ensure auth is stable
    const initialSyncDelay = setTimeout(() => {
      if (user && isAdmin && isAutoSyncEnabled && syncStatus === 'idle') {
        console.log('🔄 Starting initial data sync...');
        performDataSync();
      }
    }, 2000); // Wait 2 seconds for auth to stabilize

    const interval = setInterval(() => {
      // Only sync if we're not already syncing and user is authenticated
      if (syncStatus !== 'syncing' && user && isAdmin) {
        console.log('🔄 Auto-syncing data with Supabase...');
        performDataSync();
      }
    }, 60000); // Sync every 60 seconds

    return () => {
      clearTimeout(initialSyncDelay);
      clearInterval(interval);
    };
  }, [isAutoSyncEnabled, user, isAdmin]); // Removed syncStatus from dependencies



  const toggleAutoSync = () => {
    setIsAutoSyncEnabled(!isAutoSyncEnabled);
    toast({
      title: isAutoSyncEnabled ? "Auto-sync Disabled" : "Auto-sync Enabled",
      description: isAutoSyncEnabled 
        ? "Data will no longer sync automatically" 
        : "Data will sync every minute with Supabase",
    });
  };

  const manualSync = () => {
    if (!user || !isAdmin) {
      toast({
        title: "Sync Failed",
        description: "You must be logged in as admin to sync data",
        variant: "destructive"
      });
      return;
    }
    
    console.log('🔄 Manual sync triggered');
    performDataSync();
  };

  return (
    <DataSyncContext.Provider value={{
      isAutoSyncEnabled,
      toggleAutoSync,
      lastSyncTime,
      syncStatus,
      manualSync,
    }}>
      {children}
    </DataSyncContext.Provider>
  );
}

export function useDataSync() {
  const context = useContext(DataSyncContext);
  if (context === undefined) {
    throw new Error('useDataSync must be used within a DataSyncProvider');
  }
  return context;
}


