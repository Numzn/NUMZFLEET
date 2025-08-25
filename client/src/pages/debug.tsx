import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Database, 
  Shield, 
  Users, 
  Settings, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  MapPin,
  Wifi
} from 'lucide-react';

export default function DebugPage() {
  const [firebaseResults, setFirebaseResults] = useState<any>(null);
  const [traccarResults, setTraccarResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runFirebaseTests = async () => {
    setIsLoading(true);
    try {
      const results = {
        permissions: await (window as any).testFirebasePermissions(),
        admins: await (window as any).checkFirebaseAdmins(),
        authUsers: await (window as any).checkFirebaseAuthUsers(),
        diagnostics: await (window as any).runFirebaseDiagnostics(),
      };
      setFirebaseResults(results);
    } catch (error) {
      console.error('Firebase tests failed:', error);
      setFirebaseResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const runTraccarTests = async () => {
    setIsLoading(true);
    try {
      const results = {
        authStatus: await (window as any).debugTraccarAuth(),
        credentials: (window as any).getTraccarCredentials(),
        manualAuth: await (window as any).authenticateTraccarBackground(),
      };
      setTraccarResults(results);
    } catch (error) {
      console.error('Traccar tests failed:', error);
      setTraccarResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetFirebase = async () => {
    if (confirm('Are you sure you want to reset Firebase to initial state? This will delete all data!')) {
      try {
        await (window as any).resetFirebaseToInitial();
        alert('Firebase reset complete. Please refresh the page.');
      } catch (error) {
        alert(`Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const createTestAdmin = async () => {
    try {
      await (window as any).createTestAdmin();
      alert('Test admin created successfully!');
    } catch (error) {
      alert(`Failed to create test admin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🔧 System Debug & Diagnostics</h1>
        <p className="text-muted-foreground">
          Comprehensive testing and debugging tools for Firebase and Traccar integration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Firebase Diagnostics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Firebase Diagnostics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={runFirebaseTests} 
                disabled={isLoading}
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Run Firebase Tests
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={createTestAdmin} 
                variant="outline"
                className="flex-1"
              >
                <Users className="h-4 w-4 mr-2" />
                Create Test Admin
              </Button>
              
              <Button 
                onClick={resetFirebase} 
                variant="destructive"
                className="flex-1"
              >
                <Settings className="h-4 w-4 mr-2" />
                Reset Firebase
              </Button>
            </div>

            {firebaseResults && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Test Results:</h4>
                <pre className="text-xs overflow-auto max-h-64">
                  {JSON.stringify(firebaseResults, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Traccar Diagnostics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Traccar GPS Diagnostics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={runTraccarTests} 
                disabled={isLoading}
                className="flex-1"
              >
                <Wifi className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Test Traccar Connection
              </Button>
            </div>

            {traccarResults && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Traccar Status:</h4>
                <div className="space-y-2">
                  {traccarResults.authStatus && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Authentication:</span>
                      <Badge 
                        variant={
                          traccarResults.authStatus.authStatus === 'authenticated' ? 'default' :
                          traccarResults.authStatus.authStatus === 'not_authenticated' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {traccarResults.authStatus.authStatus}
                      </Badge>
                    </div>
                  )}
                  
                  {traccarResults.credentials && (
                    <div className="text-xs">
                      <p><strong>URL:</strong> {traccarResults.authStatus?.baseUrl}</p>
                      <p><strong>Username:</strong> {traccarResults.credentials.username}</p>
                      <p><strong>Password:</strong> {'*'.repeat(traccarResults.credentials.password.length)}</p>
                    </div>
                  )}
                  
                  {traccarResults.error && (
                    <div className="text-destructive text-sm">
                      <strong>Error:</strong> {traccarResults.error}
                    </div>
                  )}
                </div>
                
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium">Full Results</summary>
                  <pre className="text-xs overflow-auto max-h-64 mt-2">
                    {JSON.stringify(traccarResults, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Console Commands */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Console Commands
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Open your browser's Developer Console (F12) and use these commands:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Firebase Commands:</h4>
              <ul className="text-sm space-y-1">
                <li><code className="bg-muted px-1 rounded">runFirebaseDiagnostics()</code></li>
                <li><code className="bg-muted px-1 rounded">checkFirebaseAdmins()</code></li>
                <li><code className="bg-muted px-1 rounded">testFirebasePermissions()</code></li>
                <li><code className="bg-muted px-1 rounded">createTestAdmin()</code></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Traccar Commands:</h4>
              <ul className="text-sm space-y-1">
                <li><code className="bg-muted px-1 rounded">debugTraccarAuth()</code></li>
                <li><code className="bg-muted px-1 rounded">authenticateTraccarBackground()</code></li>
                <li><code className="bg-muted px-1 rounded">getTraccarCredentials()</code></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



