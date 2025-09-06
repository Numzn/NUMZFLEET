import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useVehicles } from "@/hooks/use-supabase-vehicles";
import { useFuelRecords } from "@/hooks/use-supabase-fuel-records";
import { useDrivers } from "@/hooks/use-supabase-drivers";
import React from "react";
import { FuelRecord } from "@shared/schema";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  PointElement
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

export default function Reports() {
  // RE-ENABLED: Supabase data fetching hooks
  const { data: vehicles = [] } = useVehicles()
  const { data: fuelRecords = [] } = useFuelRecords()
  const { data: drivers = [] } = useDrivers()
  const [timeFrame, setTimeFrame] = React.useState<'week' | 'month' | 'year'>('month');
  const [selectedMetric, setSelectedMetric] = React.useState<'consumption' | 'cost' | 'distance'>('consumption');

  // Helper function to format date for grouping
  const getDateKey = (date: Date) => {
    switch (timeFrame) {
      case 'week':
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
      case 'month':
        return date.toISOString().slice(0, 7); // YYYY-MM
      case 'year':
        return date.toISOString().slice(0, 4); // YYYY
      default:
        return date.toISOString().slice(0, 7);
    }
  };

  // Process fuel records for charts
  const processedData = React.useMemo(() => {
    if (!fuelRecords) return { labels: [], datasets: [] };

    // Group records by date
    const groupedData = fuelRecords?.reduce((acc: Record<string, { consumption: number; cost: number; distance: number; count: number }>, record: FuelRecord) => {
      // Fix: Use sessionDate instead of date, and add validation
      const recordDate = new Date(record.sessionDate);
      if (isNaN(recordDate.getTime())) {
        console.warn('Invalid date in fuel record:', record.sessionDate);
        return acc;
      }
      
      const dateKey = getDateKey(recordDate);
      if (!acc[dateKey]) {
        acc[dateKey] = {
          consumption: 0,
          cost: 0,
          distance: 0,
          count: 0
        };
      }
      acc[dateKey].consumption += record.fuelAmount || 0;
      acc[dateKey].cost += record.fuelCost || 0;
      acc[dateKey].distance += record.currentMileage || 0; // Use currentMileage as distance proxy
      acc[dateKey].count += 1;
      return acc;
    }, {} as Record<string, { consumption: number; cost: number; distance: number; count: number }>);

    // Sort dates
    const sortedDates = Object.keys(groupedData).sort();

    // Prepare chart data
    const labels = sortedDates;
    const data = {
      consumption: sortedDates.map(date => groupedData[date].consumption),
      cost: sortedDates.map(date => groupedData[date].cost),
      distance: sortedDates.map(date => groupedData[date].distance)
    };

    return {
      labels,
      datasets: [
        {
          label: selectedMetric === 'consumption' ? 'Fuel Consumption (L)' :
                 selectedMetric === 'cost' ? 'Total Cost ($)' : 'Distance (km)',
          data: data[selectedMetric],
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
          borderColor: 'rgb(53, 162, 235)',
          borderWidth: 1
        }
      ]
    };
  }, [fuelRecords, timeFrame, selectedMetric]);

  // Calculate summary statistics
  const stats = React.useMemo(() => {
    if (!fuelRecords || !vehicles || !drivers) return null;

    const totalFuelCost = fuelRecords?.reduce((sum: number, record: FuelRecord) => sum + (record.fuelCost || 0), 0) ?? 0;
    const totalFuelConsumption = fuelRecords?.reduce((sum: number, record: FuelRecord) => sum + (record.fuelAmount || 0), 0) ?? 0;
    const totalDistance = fuelRecords?.reduce((sum: number, record: FuelRecord) => sum + (record.currentMileage || 0), 0) ?? 0;
    const avgConsumption = totalDistance > 0 ? (totalFuelConsumption / totalDistance) * 100 : 0;

    return {
      totalVehicles: vehicles.length,
      totalDrivers: drivers.length,
      totalFuelCost: totalFuelCost.toFixed(2),
      totalFuelConsumption: totalFuelConsumption.toFixed(2),
      totalDistance: totalDistance.toFixed(2),
      avgConsumption: avgConsumption.toFixed(2)
    };
  }, [fuelRecords, vehicles, drivers]);

  return (
    <div className="min-h-screen bg-background">

      <main className="pt-20 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Fleet Reports</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Total Vehicles: {stats?.totalVehicles}</p>
                <p>Total Drivers: {stats?.totalDrivers}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fuel Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Total Consumption: {stats?.totalFuelConsumption}L</p>
                <p>Total Cost: K{stats?.totalFuelCost}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Total Distance: {stats?.totalDistance}km</p>
                <p>Avg. Consumption: {stats?.avgConsumption}L/100km</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart Controls */}
        <div className="flex gap-4 mb-6">
          <Select value={timeFrame} onValueChange={(value) => setTimeFrame(value as 'week' | 'month' | 'year')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Time Frame" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as 'consumption' | 'cost' | 'distance')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consumption">Fuel Consumption</SelectItem>
              <SelectItem value="cost">Cost</SelectItem>
              <SelectItem value="distance">Distance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Charts */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedMetric === 'consumption' ? 'Fuel Consumption Over Time' :
               selectedMetric === 'cost' ? 'Fuel Costs Over Time' :
               'Distance Traveled Over Time'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <Bar
                data={processedData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: {
                    duration: 0 // Disable animations
                  },
                  transitions: {
                    active: {
                      animation: {
                        duration: 0 // Disable hover animations
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: selectedMetric === 'consumption' ? 'Liters' :
                              selectedMetric === 'cost' ? 'Cost ($)' :
                              'Distance (km)'
                      }
                    },
                    x: {
                      title: {
                        display: true,
                        text: timeFrame === 'week' ? 'Date' :
                              timeFrame === 'month' ? 'Month' : 'Year'
                      }
                    }
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
