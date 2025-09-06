import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

export function DatabaseTest() {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'failed'>('checking');
  const [dataStatus, setDataStatus] = useState<'checking' | 'has-data' | 'no-data' | 'error'>('checking');
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  // Test database connection
  const testConnection = async () => {
    try {
      setConnectionStatus('checking');
      setError(null);
      
      // Test basic connection
      const { data, error } = await supabase.from('admins').select('count').limit(1);
      
      if (error) {
        console.error('Connection test failed:', error);
        setConnectionStatus('failed');
        setError(error.message);
        return;
      }
      
      setConnectionStatus('connected');
      console.log('✅ Database connection successful');
      
      // Now check for data
      await checkData();
      
    } catch (err: any) {
      console.error('Connection test error:', err);
      setConnectionStatus('failed');
      setError(err.message);
    }
  };

  // Check if tables have data
  const checkData = async () => {
    try {
      setDataStatus('checking');
      
      const tables = ['admins', 'vehicles', 'drivers', 'fuel_records'];
      const counts: Record<string, number> = {};
      
      for (const table of tables) {
        try {
          const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          if (error) {
            console.error(`Error checking ${table}:`, error);
            counts[table] = -1; // Error
          } else {
            counts[table] = count || 0;
          }
        } catch (err) {
          console.error(`Exception checking ${table}:`, err);
          counts[table] = -1; // Error
        }
      }
      
      setTableCounts(counts);
      
      // Determine overall data status
      const hasData = Object.values(counts).some(count => count > 0);
      const hasErrors = Object.values(counts).some(count => count === -1);
      
      if (hasErrors) {
        setDataStatus('error');
      } else if (hasData) {
        setDataStatus('has-data');
      } else {
        setDataStatus('no-data');
      }
      
    } catch (err: any) {
      console.error('Data check error:', err);
      setDataStatus('error');
      setError(err.message);
    }
  };

  // Test creating a simple record
  const testCreateRecord = async () => {
    try {
      const testData = {
        name: 'Test Driver',
        license_number: 'TEST123',
        phone_number: '+1234567890',
        email: 'test@example.com',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const { data, error } = await supabase
        .from('drivers')
        .insert(testData)
        .select()
        .single();
      
      if (error) {
        console.error('Create test failed:', error);
        setError(`Create test failed: ${error.message}`);
      } else {
        console.log('✅ Create test successful:', data);
        
        // Clean up test data
        await supabase
          .from('drivers')
          .delete()
          .eq('email', 'test@example.com');
        
        console.log('✅ Test data cleaned up');
        await checkData(); // Refresh counts
      }
      
    } catch (err: any) {
      console.error('Create test error:', err);
      setError(`Create test error: ${err.message}`);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'has-data':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'no-data':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'has-data':
        return 'text-green-600';
      case 'failed':
      case 'error':
        return 'text-red-600';
      case 'no-data':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Database Connection Test
          {getStatusIcon(connectionStatus)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="font-medium">Connection Status:</span>
          <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
            {connectionStatus === 'checking' && 'Checking...'}
            {connectionStatus === 'connected' && 'Connected'}
            {connectionStatus === 'failed' && 'Failed'}
          </Badge>
        </div>

        {/* Data Status */}
        <div className="flex items-center justify-between">
          <span className="font-medium">Data Status:</span>
          <Badge variant={
            dataStatus === 'has-data' ? 'default' : 
            dataStatus === 'no-data' ? 'secondary' : 
            'destructive'
          }>
            {dataStatus === 'checking' && 'Checking...'}
            {dataStatus === 'has-data' && 'Has Data'}
            {dataStatus === 'no-data' && 'No Data'}
            {dataStatus === 'error' && 'Error'}
          </Badge>
        </div>

        {/* Table Counts */}
        {Object.keys(tableCounts).length > 0 && (
          <div className="space-y-2">
            <span className="font-medium">Table Records:</span>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(tableCounts).map(([table, count]) => (
                <div key={table} className="flex justify-between">
                  <span className="capitalize">{table.replace('_', ' ')}:</span>
                  <span className={count === -1 ? 'text-red-600' : count === 0 ? 'text-yellow-600' : 'text-green-600'}>
                    {count === -1 ? 'Error' : count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800 font-medium">Error:</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button onClick={testConnection} variant="outline" size="sm">
            Test Connection
          </Button>
          <Button onClick={checkData} variant="outline" size="sm">
            Check Data
          </Button>
          <Button onClick={testCreateRecord} variant="outline" size="sm">
            Test Create
          </Button>
        </div>

        {/* Recommendations */}
        {dataStatus === 'no-data' && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800 font-medium">Recommendation:</p>
            <p className="text-sm text-yellow-700">
              Database is connected but has no data. You may need to create initial records or import data.
            </p>
          </div>
        )}

        {connectionStatus === 'failed' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800 font-medium">Recommendation:</p>
            <p className="text-sm text-red-700">
              Check your Supabase configuration and ensure the database is accessible.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


