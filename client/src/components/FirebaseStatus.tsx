import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getApps } from 'firebase/app';
import { testFirebaseConnection, isFirestoreAvailable } from '@/lib/firebase';
import { Database, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export function FirebaseStatus() {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const testConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('checking');
    
    try {
      // Test basic availability
      const isAvailable = isFirestoreAvailable();
      if (!isAvailable) {
        setConnectionStatus('disconnected');
        setTestResult({ success: false, error: 'Firestore is not available' });
        return;
      }

      // Test actual connection
      const result = await testFirebaseConnection();
      setTestResult(result);
      setConnectionStatus(result.success ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('disconnected');
      setTestResult({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Firebase Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection Status:</span>
          {isTesting ? (
            <Badge variant="secondary">Testing...</Badge>
          ) : connectionStatus === 'connected' ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Disconnected
            </Badge>
          )}
        </div>

        {/* Firebase App Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Firebase App:</span>
          <Badge variant={getApps().length > 0 ? "default" : "destructive"}>
            {getApps().length > 0 ? "Initialized" : "Not Initialized"}
          </Badge>
        </div>

        {/* Project Info */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Project:</span>
          <span className="text-sm text-muted-foreground font-mono">
            numzfleet
          </span>
        </div>

        {/* Test Results */}
        {testResult && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">
                {testResult.success ? 'Connection Test Passed' : 'Connection Test Failed'}
              </span>
            </div>
            {testResult.error && (
              <p className="text-sm text-muted-foreground">{testResult.error}</p>
            )}
          </div>
        )}

        {/* Troubleshooting Tips */}
        {connectionStatus === 'disconnected' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 mb-2">Troubleshooting Tips:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Check your internet connection</li>
              <li>• Verify Firebase project is active</li>
              <li>• Check browser console for detailed errors</li>
              <li>• Try refreshing the page</li>
            </ul>
          </div>
        )}

        {/* Refresh Button */}
        <Button 
          onClick={testConnection} 
          disabled={isTesting}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
          Test Connection
        </Button>
      </CardContent>
    </Card>
  );
}

