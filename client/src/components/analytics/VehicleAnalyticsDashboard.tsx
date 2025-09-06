import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Fuel, 
  Gauge, 
  MapPin, 
  Clock, 
  DollarSign,
  RefreshCw,
  Settings,
  Car,
  User
} from 'lucide-react';
import { useVehicles } from '@/hooks/use-supabase-vehicles';
import { useFuelRecords } from '@/hooks/use-supabase-fuel-records';
// TODO: Replace with Supabase hooks
// import { useTraccarSync } from '@/hooks/use-real-data';
// TODO: Replace with Supabase analytics
// import { calculateFuelMetrics, calculateEfficiencyScore } from '@/lib/analytics';
import type { Vehicle, FuelRecord } from '@shared/schema';

export function VehicleAnalyticsDashboard() {
  const { data: vehicles = [] } = useVehicles();
  const { data: fuelRecords = [] } = useFuelRecords();
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string>('');
  
  // TODO: Replace with Supabase hooks
  const syncMutation = {
    mutate: () => console.log('🔧 Supabase integration needed for Traccar sync'),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null
  };

  // Set default vehicle when vehicles load
  React.useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  // Find the selected vehicle
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  
  // Filter fuel records for the selected vehicle
  const vehicleRecords = fuelRecords.filter((r: FuelRecord) => r.vehicleId === selectedVehicleId);
  
  // Get assigned driver info
  const assignedDriver = selectedVehicle?.driverId ? { id: selectedVehicle.driverId, name: 'Driver' } : null;

  // Calculate real vehicle-specific metrics using actual data
  // TODO: Replace with Supabase analytics
  const fuelMetrics = React.useMemo(() => {
    if (!vehicleRecords || vehicleRecords.length === 0) {
      return {
        totalCost: 0,
        totalFuelUsed: 0,
        totalUsage: 0,
        averageUsage: 0,
        monthlyTrend: []
      };
    }

    const totalCost = vehicleRecords.reduce((sum, record) => sum + (record.fuelCost || 0), 0);
    const totalFuelUsed = vehicleRecords.reduce((sum, record) => sum + (record.fuelAmount || 0), 0);
    const averageUsage = totalFuelUsed / vehicleRecords.length;

    // Calculate monthly trends
    const monthlyTrend = vehicleRecords.reduce((acc, record) => {
      const date = new Date(record.sessionDate);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, totalFuel: 0, totalCost: 0 };
      }
      
      acc[monthKey].totalFuel += record.fuelAmount || 0;
      acc[monthKey].totalCost += record.fuelCost || 0;
      
      return acc;
    }, {} as Record<string, { month: string; totalFuel: number; totalCost: number }>);

    return {
      totalCost,
      totalFuelUsed,
      totalUsage: totalFuelUsed,
      averageUsage,
      monthlyTrend: Object.values(monthlyTrend)
    };
  }, [vehicleRecords]);

  const efficiencyScore = React.useMemo(() => {
    if (!fuelMetrics.totalFuelUsed || fuelMetrics.totalFuelUsed === 0) {
      return 0;
    }
    
    // Simple efficiency calculation based on fuel usage patterns
    // Higher score for lower fuel consumption relative to distance
    const avgFuelPerSession = fuelMetrics.totalFuelUsed / vehicleRecords.length;
    const baseScore = Math.max(0, 100 - (avgFuelPerSession * 2)); // Lower fuel = higher score
    return Math.round(Math.min(100, Math.max(0, baseScore)));
  }, [fuelMetrics.totalFuelUsed, vehicleRecords.length]);

  const lastRefuelDate = React.useMemo(() => {
    if (!vehicleRecords || vehicleRecords.length === 0) {
      return new Date();
    }
    return new Date(Math.max(...vehicleRecords.map((r: FuelRecord) => new Date(r.sessionDate).getTime())));
  }, [vehicleRecords]);

  // Real fuel station data (this would come from an actual fuel station API)
  const fuelStations = {
    total: 0, // Will be populated from real API
    online: 0,
    offline: 0,
    available: 0,
    inUse: 0,
    unavailable: 0
  };

  // Recent refuel history
  const recentRefuels = vehicleRecords
    .sort((a: FuelRecord, b: FuelRecord) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
    .slice(0, 3);

  // Monthly fuel usage trend from real data
  const monthlyData = React.useMemo(() => {
    if (fuelMetrics.monthlyTrend.length === 0) {
      return [];
    }
    return fuelMetrics.monthlyTrend.map(trend => ({
      month: trend.month,
      usage: trend.totalFuel,
      cost: trend.totalCost
    }));
  }, [fuelMetrics.monthlyTrend]);

  if (!selectedVehicle) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No vehicles available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vehicle Selector Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select vehicle" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((vehicle: Vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} - {vehicle.registrationNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">Switch Vehicle</Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync GPS Data'}
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{selectedVehicle.name}</span>
              <Badge variant="outline">Live</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Current Mileage</p>
                <p className="text-2xl font-bold">{selectedVehicle.currentMileage || '0'}</p>
                <p className="text-xs text-muted-foreground">km</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Fuel Type</p>
                <p className="text-lg font-semibold">{selectedVehicle.fuelType || 'N/A'}</p>
              </div>
            </div>
            
            {assignedDriver && (
              <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Assigned Driver</p>
                  <p className="text-xs text-muted-foreground">{assignedDriver.name}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vehicle GPS Tracking Map */}
        {/* The TraccarIframe component was removed from imports, so this section is commented out or removed if not needed */}
        {/* <TraccarIframe 
          deviceId={selectedVehicle.traccarDeviceId}
          height="500px"
          showControls={false}
          autoRefresh={false}
          refreshInterval={30000}
        /> */}
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Fuel Stations Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fuel Stations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{fuelStations.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{fuelStations.online}%</p>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-green-600">{fuelStations.available}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-600">{fuelStations.inUse}</p>
                <p className="text-xs text-muted-foreground">In Use</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-600">{fuelStations.unavailable}</p>
                <p className="text-xs text-muted-foreground">Unavailable</p>
              </div>
            </div>
            {/* Donut Chart */}
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-green-400 via-blue-400 to-red-400 flex items-center justify-center">
                <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">{fuelStations.available}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fuel Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fuel Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentRefuels.slice(0, 3).map((refuel, index) => (
              <div key={refuel.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-purple-100 text-purple-600' : 
                    index === 1 ? 'bg-orange-100 text-orange-600' : 
                    'bg-green-100 text-green-600'
                  }`}>
                    <Fuel className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {new Date(refuel.sessionDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {refuel.fuelAmount.toFixed(1)}L
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{refuel.fuelAmount.toFixed(0)}L</p>
                  <p className="text-xs text-muted-foreground">
                    ${refuel.fuelCost.toFixed(0)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* History Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <Button variant="ghost" size="sm">24 hours</Button>
                <Button variant="default" size="sm">30 days</Button>
                <Button variant="ghost" size="sm">1 year</Button>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Fuel Usage</p>
                <p className="text-2xl font-bold">{fuelMetrics.totalFuelUsed.toFixed(0)}L</p>
              </div>
              {/* Simple bar chart representation */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>1</span>
                  <span>7</span>
                  <span>14</span>
                  <span>21</span>
                  <span>30</span>
                </div>
                <div className="flex items-end space-x-1 h-16">
                  {[40, 60, 100, 45, 80].map((height, i) => (
                    <div 
                      key={i} 
                      className="bg-blue-500 flex-1 rounded-t" 
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Smart Efficiency Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Efficiency Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative w-24 h-24">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center">
                <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold">{efficiencyScore}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Based on fuel patterns</p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fuel Usage Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Fuel Usage & Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-end space-x-1 h-32">
                {monthlyData.slice(0, 6).map((data, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div 
                      className="bg-purple-500 w-full rounded-t mb-1" 
                      style={{ height: `${(data.usage / Math.max(...monthlyData.map(d => d.usage), 1)) * 100}%` }}
                    />
                    <span className="text-xs text-muted-foreground">{data.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Cost */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold">${(fuelMetrics.totalCost / (vehicleRecords.length || 1)).toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Per refuel session</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold">${fuelMetrics.totalCost.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Total Cost</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{vehicleRecords.length}</p>
                  <p className="text-xs text-muted-foreground">Sessions</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { time: '10:00 - 13:0', fuel: '9 kWh', days: 'MO TU' },
                { time: '12:00 - 15:0', fuel: '7 kWh', days: 'TU WE TH' },
                { time: '15:00 - 17:0', fuel: '26 kWh', days: 'MO TU FR' }
              ].map((schedule, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium text-sm">{schedule.time}</p>
                    <p className="text-xs text-muted-foreground">{schedule.days}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{schedule.fuel}</span>
                    <div className="w-8 h-4 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-2">
                + Add New Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
