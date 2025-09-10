import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Clock,
  Server
} from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { traccarApi } from '@/lib/traccar';

export const NetworkStatusIndicator = () => {
  const {
    isOnline,
    isConnected,
    lastError,
    retryCount,
    isRetrying,
    testServerConnection,
    retry,
    resetRetryCount
  } = useNetworkStatus();

  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Test Traccar server connection
  const testTraccarConnection = async () => {
    setIsTestingConnection(true);
    setServerStatus('checking');
    
    try {
      const isConnected = await traccarApi.testConnection();
      setServerStatus(isConnected ? 'online' : 'offline');
    } catch (error) {
      console.error('Traccar connection test failed:', error);
      setServerStatus('offline');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Test connection on mount and when network status changes
  useEffect(() => {
    if (isOnline) {
      testTraccarConnection();
    } else {
      setServerStatus('offline');
    }
  }, [isOnline]);

  // Auto-retry when connection is restored
  useEffect(() => {
    if (isOnline && isConnected && retryCount > 0) {
      resetRetryCount();
    }
  }, [isOnline, isConnected, retryCount, resetRetryCount]);

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />;
    if (isRetrying) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (serverStatus === 'online' && isConnected) return <CheckCircle className="h-4 w-4" />;
    if (serverStatus === 'offline' || !isConnected) return <XCircle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (isRetrying) return 'bg-yellow-500';
    if (serverStatus === 'online' && isConnected) return 'bg-green-500';
    if (serverStatus === 'offline' || !isConnected) return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'No Internet';
    if (isRetrying) return 'Retrying...';
    if (serverStatus === 'online' && isConnected) return 'Connected';
    if (serverStatus === 'offline' || !isConnected) return 'Disconnected';
    return 'Checking...';
  };

  const getErrorMessage = () => {
    if (!isOnline) return 'No internet connection detected';
    if (lastError) return lastError;
    if (serverStatus === 'offline') return 'Cannot reach Traccar server';
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Network Status
          </div>
          <Badge 
            variant="secondary" 
            className={`${getStatusColor()} text-white flex items-center gap-1`}
          >
            {getStatusIcon()}
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Connection Details */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Internet:</span>
            <Badge variant={isOnline ? "default" : "destructive"} className="text-xs">
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Server:</span>
            <Badge 
              variant={serverStatus === 'online' ? "default" : "destructive"} 
              className="text-xs"
            >
              {serverStatus === 'checking' ? 'Checking...' : serverStatus}
            </Badge>
          </div>
        </div>

        {/* Error Message */}
        {getErrorMessage() && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
            <div className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-3 w-3" />
              <span className="font-medium">Error:</span>
            </div>
            <p className="text-muted-foreground mt-1">{getErrorMessage()}</p>
          </div>
        )}

        {/* Retry Information */}
        {retryCount > 0 && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Retry attempts: {retryCount}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetRetryCount}
              className="h-6 px-2 text-xs"
            >
              Reset
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testTraccarConnection}
            disabled={isTestingConnection || !isOnline}
            className="flex-1 text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isTestingConnection ? 'animate-spin' : ''}`} />
            Test Connection
          </Button>
          
          {!isOnline && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="flex-1 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reload Page
            </Button>
          )}
        </div>

        {/* Server URL */}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Server:</span>{' '}
          <code className="bg-muted px-1 rounded">
            {import.meta.env.VITE_TRACCAR_URL || 'http://localhost:8082'}
          </code>
        </div>
      </CardContent>
    </Card>
  );
};

