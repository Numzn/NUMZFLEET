import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavigationBar } from "@/components/NavigationBar";
import { useVehicles } from "@/hooks/use-vehicles";
import { useFuelRecords } from "@/hooks/use-fuel-records";
import { useDrivers } from "@/hooks/use-drivers";
import React from "react";
import { FuelRecord, Vehicle, Driver } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart3, PieChart, Activity } from "lucide-react";
import { format, subMonths, subDays, subWeeks, isWithinInterval, parseISO } from "date-fns";
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
import { Bar, Line, Pie, Doughnut, Radar } from 'react-chartjs-2';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";

// Register ChartJS components
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

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

type KPICard = {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  description: string;
};

export default function AdvancedReports() {
  const { data: vehicles = [] } = useVehicles();
  const { data: fuelRecords = [] } = useFuelRecords();
  const { data: drivers = [] } = useDrivers();

  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: subMonths(new Date(), 3),
    to: new Date(),
  });
  const [selectedVehicles, setSelectedVehicles] = React.useState<string[]>([]);
  const [comparisonPeriod, setComparisonPeriod] = React.useState<'week' | 'month' | 'quarter'>('month');

  // Filter data based on date range and selected vehicles
  const filteredRecords = React.useMemo(() => {
    if (!fuelRecords || fuelRecords.length === 0) return [];
    
    return fuelRecords.filter(record => {
      if (!record.sessionDate) return false;
      
      const recordDate = parseISO(record.sessionDate);
      if (isNaN(recordDate.getTime())) return false;
      
      const inDateRange = (dateRange?.from && dateRange?.to) ? 
        isWithinInterval(recordDate, { start: dateRange.from, end: dateRange.to }) : true;
      const inVehicleFilter = selectedVehicles.length === 0 || selectedVehicles.includes(record.vehicleId);
      return inDateRange && inVehicleFilter;
    });
  }, [fuelRecords, dateRange, selectedVehicles]);

  // Calculate comprehensive KPIs
  const kpis = React.useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return [] as KPICard[];
    }
    
    const currentPeriodData = filteredRecords;
    const previousPeriodStart = comparisonPeriod === 'week' ? subWeeks(dateRange.from, 1) :
                               comparisonPeriod === 'month' ? subMonths(dateRange.from, 1) :
                               subMonths(dateRange.from, 3);
    const previousPeriodEnd = dateRange.from;
    
    const previousPeriodData = fuelRecords.filter(record => {
      const recordDate = parseISO(record.sessionDate);
      return isWithinInterval(recordDate, { start: previousPeriodStart, end: previousPeriodEnd });
    });

    const currentTotalCost = currentPeriodData.reduce((sum, record) => sum + (record.fuelCost || 0), 0);
    const previousTotalCost = previousPeriodData.reduce((sum, record) => sum + (record.fuelCost || 0), 0);
    const costChange = previousTotalCost > 0 ? ((currentTotalCost - previousTotalCost) / previousTotalCost * 100) : 0;

    const currentTotalFuel = currentPeriodData.reduce((sum, record) => sum + (record.fuelAmount || 0), 0);
    const previousTotalFuel = previousPeriodData.reduce((sum, record) => sum + (record.fuelAmount || 0), 0);
    const fuelChange = previousTotalFuel > 0 ? ((currentTotalFuel - previousTotalFuel) / previousTotalFuel * 100) : 0;

    const avgEfficiency = currentPeriodData.length > 0 ? 
      currentPeriodData.reduce((sum, record) => sum + (record.fuelEfficiency || 0), 0) / currentPeriodData.length : 0;
    const prevAvgEfficiency = previousPeriodData.length > 0 ? 
      previousPeriodData.reduce((sum, record) => sum + (record.fuelEfficiency || 0), 0) / previousPeriodData.length : 0;
    const efficiencyChange = prevAvgEfficiency > 0 ? ((avgEfficiency - prevAvgEfficiency) / prevAvgEfficiency * 100) : 0;

    const activeVehicles = new Set(currentPeriodData.map(r => r.vehicleId)).size;
    const costPerVehicle = activeVehicles > 0 ? currentTotalCost / activeVehicles : 0;

    return [
      {
        title: "Total Fuel Cost",
        value: formatCurrency(currentTotalCost),
        change: `${costChange >= 0 ? '+' : ''}${costChange.toFixed(1)}%`,
        trend: costChange > 0 ? 'up' : costChange < 0 ? 'down' : 'neutral',
        icon: <TrendingUp className="h-4 w-4" />,
        description: `vs previous ${comparisonPeriod}`
      },
      {
        title: "Fuel Consumption",
        value: `${currentTotalFuel.toFixed(1)}L`,
        change: `${fuelChange >= 0 ? '+' : ''}${fuelChange.toFixed(1)}%`,
        trend: fuelChange > 0 ? 'up' : fuelChange < 0 ? 'down' : 'neutral',
        icon: <Activity className="h-4 w-4" />,
        description: `vs previous ${comparisonPeriod}`
      },
      {
        title: "Avg Efficiency",
        value: `${avgEfficiency.toFixed(2)} km/L`,
        change: `${efficiencyChange >= 0 ? '+' : ''}${efficiencyChange.toFixed(1)}%`,
        trend: efficiencyChange > 0 ? 'up' : efficiencyChange < 0 ? 'down' : 'neutral',
        icon: <CheckCircle className="h-4 w-4" />,
        description: `vs previous ${comparisonPeriod}`
      },
      {
        title: "Cost per Vehicle",
        value: formatCurrency(costPerVehicle),
        change: `${activeVehicles} vehicles active`,
        trend: 'neutral',
        icon: <BarChart3 className="h-4 w-4" />,
        description: "Average cost per active vehicle"
      }
    ] as KPICard[];
  }, [filteredRecords, fuelRecords, dateRange, comparisonPeriod]);

  // Vehicle performance analysis
  const vehiclePerformance = React.useMemo(() => {
    const vehicleStats = vehicles.map(vehicle => {
      const vehicleRecords = filteredRecords.filter(r => r.vehicleId === vehicle.id);
      const totalCost = vehicleRecords.reduce((sum, r) => sum + (r.fuelCost || 0), 0);
      const totalFuel = vehicleRecords.reduce((sum, r) => sum + (r.fuelAmount || 0), 0);
      const avgEfficiency = vehicleRecords.length > 0 ? 
        vehicleRecords.reduce((sum, r) => sum + (r.fuelEfficiency || 0), 0) / vehicleRecords.length : 0;
      const budgetVariance = vehicle.budget ? ((totalCost - vehicle.budget) / vehicle.budget * 100) : 0;

      return {
        vehicle,
        totalCost,
        totalFuel,
        avgEfficiency,
        budgetVariance,
        recordCount: vehicleRecords.length,
        status: budgetVariance > 10 ? 'over-budget' : budgetVariance < -10 ? 'under-budget' : 'on-track'
      };
    }).filter(stat => stat.recordCount > 0);

    return vehicleStats.sort((a, b) => b.totalCost - a.totalCost);
  }, [vehicles, filteredRecords]);

  // Chart data
  const fuelTrendData = React.useMemo(() => {
    const monthlyData = filteredRecords.reduce((acc, record) => {
      const month = format(parseISO(record.sessionDate), 'MMM yyyy');
      if (!acc[month]) {
        acc[month] = { cost: 0, fuel: 0, count: 0 };
      }
      acc[month].cost += record.fuelCost || 0;
      acc[month].fuel += record.fuelAmount || 0;
      acc[month].count += 1;
      return acc;
    }, {} as Record<string, { cost: number; fuel: number; count: number }>);

    const labels = Object.keys(monthlyData).sort();
    return {
      labels,
      datasets: [
        {
          label: 'Fuel Cost (ZMW)',
          data: labels.map(label => monthlyData[label].cost),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Fuel Amount (L)',
          data: labels.map(label => monthlyData[label].fuel),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          yAxisID: 'y1',
        }
      ]
    };
  }, [filteredRecords]);

  const vehicleDistributionData = React.useMemo(() => {
    const vehicleCosts = vehiclePerformance.map(vp => ({
      label: vp.vehicle.name,
      value: vp.totalCost
    }));

    return {
      labels: vehicleCosts.map(v => v.label),
      datasets: [{
        data: vehicleCosts.map(v => v.value),
        backgroundColor: [
          '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
          '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
        ],
        borderWidth: 0,
      }]
    };
  }, [vehiclePerformance]);

  const exportToPDF = () => {
    if (!dateRange?.from || !dateRange?.to) {
      console.warn('Date range not set for export');
      return;
    }
    
    // Create PDF with html2canvas and jsPDF
    const reportData = {
      dateRange: `${format(dateRange.from, 'yyyy-MM-dd')} to ${format(dateRange.to, 'yyyy-MM-dd')}`,
      kpis,
      vehiclePerformance,
      totalRecords: filteredRecords.length
    };
    
    // Create a simple data export for now
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fleet-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
  };

  const exportToExcel = () => {
    // Create CSV data for Excel compatibility
    const csvData = [
      ['Vehicle', 'Total Cost', 'Total Fuel', 'Efficiency', 'Budget Variance', 'Status'],
      ...vehiclePerformance.map(vp => [
        vp.vehicle.name,
        vp.totalCost.toFixed(2),
        vp.totalFuel.toFixed(2),
        vp.avgEfficiency.toFixed(2),
        `${vp.budgetVariance.toFixed(1)}%`,
        vp.status
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const dataBlob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fleet-performance-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      <main className="pt-20 max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Fleet Analytics</h1>
            <p className="text-muted-foreground">Comprehensive fleet performance insights</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToPDF}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Filters & Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from && dateRange?.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : dateRange?.from ? (
                        format(dateRange.from, "LLL dd, y")
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange(range as any)
                        }
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Comparison Period</label>
                <Select value={comparisonPeriod} onValueChange={(value) => setComparisonPeriod(value as 'week' | 'month' | 'quarter')}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="quarter">Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Vehicles</label>
                <Select>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vehicles</SelectItem>
                    {vehicles.map(vehicle => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpis.map((kpi, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {kpi.icon}
                    <span className="text-sm font-medium text-muted-foreground">{kpi.title}</span>
                  </div>
                  <Badge variant={kpi.trend === 'up' ? 'destructive' : kpi.trend === 'down' ? 'default' : 'secondary'}>
                    {kpi.trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                     kpi.trend === 'down' ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
                    {kpi.change}
                  </Badge>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <Tabs defaultValue="trends" className="space-y-6">
          <TabsList>
            <TabsTrigger value="trends">Fuel Trends</TabsTrigger>
            <TabsTrigger value="distribution">Cost Distribution</TabsTrigger>
            <TabsTrigger value="performance">Vehicle Performance</TabsTrigger>
            <TabsTrigger value="efficiency">Efficiency Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle>Fuel Cost & Consumption Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <Line 
                    data={fuelTrendData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: { intersect: false },
                      scales: {
                        y: { type: 'linear', display: true, position: 'left' },
                        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } }
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution">
            <Card>
              <CardHeader>
                <CardTitle>Fuel Cost Distribution by Vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <Doughnut 
                    data={vehicleDistributionData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'right' }
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Performance Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vehiclePerformance.map((vp, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold">{vp.vehicle.name}</h3>
                          <p className="text-sm text-muted-foreground">{vp.vehicle.model}</p>
                        </div>
                        <Badge variant={
                          vp.status === 'over-budget' ? 'destructive' : 
                          vp.status === 'under-budget' ? 'default' : 'secondary'
                        }>
                          {vp.status === 'over-budget' ? 'Over Budget' : 
                           vp.status === 'under-budget' ? 'Under Budget' : 'On Track'}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(vp.totalCost)}</div>
                        <div className="text-sm text-muted-foreground">
                          {vp.budgetVariance >= 0 ? '+' : ''}{vp.budgetVariance.toFixed(1)}% vs budget
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="efficiency">
            <Card>
              <CardHeader>
                <CardTitle>Fuel Efficiency Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {vehiclePerformance.reduce((sum, vp) => sum + vp.avgEfficiency, 0) / vehiclePerformance.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Average Fleet Efficiency (km/L)</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.max(...vehiclePerformance.map(vp => vp.avgEfficiency)) || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Best Efficiency (km/L)</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {Math.min(...vehiclePerformance.map(vp => vp.avgEfficiency)) || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Lowest Efficiency (km/L)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
