import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wifi, WifiOff, Car, PlayCircle, AlertCircle } from 'lucide-react';
import { traccarApi } from '@/lib/traccar';

export const TraccarConnectionTest = () => {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const testConnection = async () => {
    setIsLoading(true);
    setStatus('checking');
    
    try {
      console.log('🔍 Testing connection to real Traccar server...');
      // Test connection by fetching devices
      const deviceData = await traccarApi.getDevices();
      setDevices(deviceData);
      setStatus('online');
      console.log('✅ Traccar connection successful!');
    } catch (error) {
      console.error('❌ Traccar connection test failed:', error);
      setStatus('offline');
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const totalCount = devices.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Traccar GPS Connection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection Status:</span>
          {isLoading ? (
            <Badge variant="secondary">Checking...</Badge>
          ) : status === 'online' ? (
            <Badge variant="default" className="bg-green-500">
              <Wifi className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive">
              <WifiOff className="h-3 w-3 mr-1" />
              Disconnected
            </Badge>
          )}
        </div>

                 {/* Mode */}
         <div className="flex items-center justify-between">
           <span className="text-sm font-medium">Mode:</span>
           <Badge variant="default" className="bg-blue-500 flex items-center gap-1">
             <PlayCircle className="h-3 w-3" />
             Production (Real Traccar)
           </Badge>
         </div>

        {/* Server URL */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Server URL:</span>
          <span className="text-sm text-muted-foreground font-mono">
            {import.meta.env.VITE_TRACCAR_URL || 'http://localhost:8082'}
          </span>
        </div>

        {/* Device Statistics */}
        {status === 'online' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Devices:</span>
              <Badge variant="outline" className="flex items-center gap-1">
                <Car className="h-3 w-3" />
                {totalCount} devices
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Online Devices:</span>
              <Badge variant="default" className="bg-green-500">
                {onlineCount} online
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Offline Devices:</span>
              <Badge variant="secondary">
                {totalCount - onlineCount} offline
              </Badge>
            </div>
          </>
        )}

        {/* Device List */}
        {devices.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Available Devices:</span>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <Car className="h-3 w-3" />
                    <span className="font-medium">{device.name}</span>
                    <span className="text-muted-foreground text-xs">({device.uniqueId})</span>
                  </div>
                  <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                    {device.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'offline' && !isLoading && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Connection Failed</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Unable to connect to Traccar server. Please check your configuration and server status.
            </p>
          </div>
        )}

        {/* Refresh Button */}
        <Button 
          onClick={testConnection} 
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Connection
        </Button>
      </CardContent>
    </Card>
  );
}; 