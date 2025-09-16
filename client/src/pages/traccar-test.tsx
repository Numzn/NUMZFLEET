import React, { useState, useEffect } from 'react';
import { traccarApi } from '@/lib/traccar';

/**
 * Traccar Connection Test Page
 * This page tests the Traccar API connection directly
 */
export default function TraccarTestPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runTest = async () => {
    setIsLoading(true);
    setTestResults(null);

    try {
      console.log('🧪 Testing Traccar API connection...');
      
      // Test 1: Connection test
      const connectionTest = await traccarApi.testConnection();
      console.log('Connection test result:', connectionTest);

      // Test 2: Get devices
      const devices = await traccarApi.getDevices();
      console.log('Devices result:', devices);

      // Test 3: Get positions
      const positions = await traccarApi.getPositions();
      console.log('Positions result:', positions);

      setTestResults({
        connection: connectionTest,
        devicesCount: devices.length,
        positionsCount: positions.length,
        devices: devices.slice(0, 3), // First 3 devices
        positions: positions.slice(0, 3), // First 3 positions
        success: true
      });

    } catch (error) {
      console.error('Test failed:', error);
      setTestResults({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Traccar API Connection Test</h1>
        
        <div className="mb-6">
          <button 
            onClick={runTest}
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Run Test Again'}
          </button>
        </div>

        {isLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Testing Traccar API connection...</span>
            </div>
          </div>
        )}

        {testResults && (
          <div className="space-y-4">
            {testResults.success ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Connection Successful!</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Connection Test:</strong> {testResults.connection ? 'PASSED' : 'FAILED'}</p>
                  <p><strong>Devices Found:</strong> {testResults.devicesCount}</p>
                  <p><strong>Positions Found:</strong> {testResults.positionsCount}</p>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-red-800 mb-2">❌ Connection Failed!</h3>
                <p className="text-sm text-red-700">{testResults.error}</p>
              </div>
            )}

            {testResults.devices && testResults.devices.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Sample Devices:</h4>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto">
                  {JSON.stringify(testResults.devices, null, 2)}
                </pre>
              </div>
            )}

            {testResults.positions && testResults.positions.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Sample Positions:</h4>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto">
                  {JSON.stringify(testResults.positions, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}




