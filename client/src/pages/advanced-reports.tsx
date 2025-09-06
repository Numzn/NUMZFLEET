import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useVehicles } from "@/hooks/use-supabase-vehicles";
import { useFuelRecords } from "@/hooks/use-supabase-fuel-records";
import { useDrivers } from "@/hooks/use-supabase-drivers";
import { FuelRecord, Vehicle, Driver } from "@shared/schema";
import { useAdvancedReports } from "@/hooks/use-advanced-reports";
import { FilterControls } from "@/components/reports/FilterControls";
import { KPISection } from "@/components/reports/KPISection";
import { ChartsSection } from "@/components/reports/ChartsSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, PieChart, Activity, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

// Register ChartJS components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale
);

export default function AdvancedReports() {
  const { data: vehicles = [] } = useVehicles();
  const { data: fuelRecords = [] } = useFuelRecords();
  const { data: drivers = [] } = useDrivers();

  const {
    dateRange,
    setDateRange,
    selectedVehicles,
    setSelectedVehicles,
    comparisonPeriod,
    setComparisonPeriod,
    filteredRecords,
    kpis,
    chartData
  } = useAdvancedReports(vehicles, fuelRecords, drivers);

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export data for:', { dateRange, selectedVehicles, filteredRecords });
  };

  return (
    <div className="min-h-screen bg-background">

      
      {/* Main Content */}
      <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Advanced Reports</h1>
              <p className="text-muted-foreground mt-2">
                Comprehensive analytics and insights for your fleet operations
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Filters & Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <FilterControls
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              selectedVehicles={selectedVehicles}
              onVehicleSelectionChange={setSelectedVehicles}
              comparisonPeriod={comparisonPeriod}
              onComparisonPeriodChange={setComparisonPeriod}
              vehicles={vehicles}
              onExport={handleExport}
            />
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="kpis" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              KPIs
            </TabsTrigger>
            <TabsTrigger value="charts" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Charts
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredRecords.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Fuel records in selected period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Vehicles</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{vehicles.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Total fleet vehicles
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{drivers.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Registered drivers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredRecords.length > 0 ? 'Good' : 'No Data'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Data completeness
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick KPI Preview */}
            {kpis.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Key Performance Indicators</CardTitle>
                </CardHeader>
                <CardContent>
                  <KPISection kpis={kpis} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* KPIs Tab */}
          <TabsContent value="kpis" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Detailed KPIs with period-over-period comparisons
                </p>
              </CardHeader>
              <CardContent>
                <KPISection kpis={kpis} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="charts" className="mt-6">
            <ChartsSection chartData={chartData} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
