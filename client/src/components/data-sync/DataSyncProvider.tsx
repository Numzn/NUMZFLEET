import React, { createContext, useContext, useEffect, useState } from 'react';
// TODO: Replace with Supabase data sync
// import { useTraccarSync } from '@/hooks/use-real-data';
import { useToast } from '@/hooks/use-toast';

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
  
  // TODO: Replace with Supabase data sync
  const syncMutation = {
    mutate: () => console.log('🔧 Supabase integration needed for data sync'),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null
  };
  const { toast } = useToast();

  // Auto-sync effect - more frequent but less noticeable
  useEffect(() => {
    if (!isAutoSyncEnabled) return;

    // Initial sync on mount
    syncMutation.mutate();

    const interval = setInterval(() => {
      // Only sync if we're not already syncing and there's no error
      // Also check if the error is a credential error to prevent infinite retries
      if (!syncMutation.isPending && 
          (syncMutation.error === null || 
           (syncMutation.error instanceof Error && 
            !syncMutation.error.message.includes('credentials not configured')))) {
        console.log('🔄 Auto-syncing Traccar data...');
        syncMutation.mutate();
      } else if (syncMutation.error instanceof Error && 
                 syncMutation.error.message.includes('credentials not configured')) {
        console.warn('⚠️ Skipping auto-sync due to credential errors');
      }
    }, 60000); // Sync every 60 seconds (less frequent)

    return () => clearInterval(interval);
  }, [isAutoSyncEnabled, syncMutation]);

  // Monitor sync status with minimal visual feedback
  useEffect(() => {
    if (syncMutation.isPending) {
      setSyncStatus('syncing');
    } else if (syncMutation.isSuccess) {
      setSyncStatus('success');
      setLastSyncTime(new Date().toISOString());
      // Quick success feedback, then back to idle
      setTimeout(() => setSyncStatus('idle'), 1000);
    } else if (syncMutation.isError) {
      setSyncStatus('error');
      // Error feedback for a bit longer, then back to idle
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [syncMutation.isPending, syncMutation.isSuccess, syncMutation.isError]);

  const toggleAutoSync = () => {
    setIsAutoSyncEnabled(!isAutoSyncEnabled);
    toast({
      title: isAutoSyncEnabled ? "Auto-sync Disabled" : "Auto-sync Enabled",
      description: isAutoSyncEnabled 
        ? "GPS data will no longer sync automatically" 
        : "GPS data will sync every minute",
    });
  };

  const manualSync = () => {
    console.log('🔄 Manual sync triggered');
    syncMutation.mutate();
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


