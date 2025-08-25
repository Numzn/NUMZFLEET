import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wifi, WifiOff, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { useDataSync } from './DataSyncProvider';

export function SyncStatusIndicator() {
  const { isAutoSyncEnabled, toggleAutoSync, lastSyncTime, syncStatus, manualSync } = useDataSync();

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return isAutoSyncEnabled ? <Wifi className="h-3 w-3 text-green-500" /> : <WifiOff className="h-3 w-3 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'success':
        return 'Synced';
      case 'error':
        return 'Error';
      default:
        return isAutoSyncEnabled ? 'Connected' : 'Disconnected';
    }
  };

  const getStatusColor = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'success':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return isAutoSyncEnabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="flex items-center justify-between">
      {/* Status Display - Minimal and Clean */}
      <div className="flex items-center space-x-2">
        <Badge variant="outline" className={`text-xs px-2 py-1 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="ml-1 font-medium">{getStatusText()}</span>
        </Badge>
        
        {/* Last sync time - Very subtle */}
        {lastSyncTime && syncStatus === 'idle' && (
          <span className="text-xs text-muted-foreground opacity-60">
            {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      
      {/* Controls - Minimal and Collapsible */}
      <div className="flex items-center space-x-1">
        {/* Settings button for advanced controls */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleAutoSync}
          className="h-6 w-6 p-0 hover:bg-muted/50"
          title={isAutoSyncEnabled ? "Disable auto-sync" : "Enable auto-sync"}
        >
          <Settings className="h-3 w-3" />
        </Button>
        
        {/* Manual sync - Only show when needed */}
        {syncStatus === 'error' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={manualSync}
            disabled={syncStatus === 'syncing'}
            className="h-6 px-2 text-xs hover:bg-muted/50"
            title="Retry sync"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}


