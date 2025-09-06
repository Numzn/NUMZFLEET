import { useMemo, useState } from "react";
import { subMonths, subDays, subWeeks, isWithinInterval, parseISO } from "date-fns";
import { DateRange } from "@/components/reports/DateRangePicker";
import { KPICardData } from "@/components/reports/KPICard";
import { formatCurrency } from "@/lib/currency";

export function useAdvancedReports(
  vehicles: any[],
  fuelRecords: any[],
  drivers: any[]
) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subMonths(new Date(), 3),
    to: new Date(),
  });
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [comparisonPeriod, setComparisonPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // Filter data based on date range and selected vehicles
  const filteredRecords = useMemo(() => {
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
  const kpis = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return [] as Omit<KPICardData, 'icon'>[];
    }

    const totalFuel = filteredRecords.reduce((sum, record) => sum + (record.fuelAmount || 0), 0);
    const totalCost = filteredRecords.reduce((sum, record) => sum + (record.totalCost || 0), 0);
    const totalDistance = filteredRecords.reduce((sum, record) => sum + (record.distance || 0), 0);
    const avgEfficiency = totalFuel > 0 ? totalDistance / totalFuel : 0;

    // Calculate previous period for comparison
    const periodDays = comparisonPeriod === 'week' ? 7 : comparisonPeriod === 'month' ? 30 : 90;
    const previousFrom = subDays(dateRange.from, periodDays);
    const previousTo = subDays(dateRange.to, periodDays);

    const previousRecords = fuelRecords.filter(record => {
      if (!record.sessionDate) return false;
      const recordDate = parseISO(record.sessionDate);
      if (isNaN(recordDate.getTime())) return false;
      return isWithinInterval(recordDate, { start: previousFrom, end: previousTo });
    });

    const prevTotalFuel = previousRecords.reduce((sum, record) => sum + (record.fuelAmount || 0), 0);
    const prevTotalCost = previousRecords.reduce((sum, record) => sum + (record.totalCost || 0), 0);
    const prevTotalDistance = previousRecords.reduce((sum, record) => sum + (record.distance || 0), 0);

    // Calculate changes
    const fuelChange = prevTotalFuel > 0 ? ((totalFuel - prevTotalFuel) / prevTotalFuel) * 100 : 0;
    const costChange = prevTotalCost > 0 ? ((totalCost - prevTotalCost) / prevTotalCost) * 100 : 0;
    const distanceChange = prevTotalDistance > 0 ? ((totalDistance - prevTotalDistance) / prevTotalDistance) * 100 : 0;

    return [
      {
        title: "Total Fuel Consumption",
        value: `${totalFuel.toFixed(1)} L`,
        change: `${fuelChange > 0 ? '+' : ''}${fuelChange.toFixed(1)}%`,
        trend: fuelChange > 0 ? 'up' : fuelChange < 0 ? 'down' : 'neutral',
        iconName: 'fuel',
        description: "vs previous period"
      },
      {
        title: "Total Cost",
        value: formatCurrency(totalCost),
        change: `${costChange > 0 ? '+' : ''}${costChange.toFixed(1)}%`,
        trend: costChange > 0 ? 'up' : costChange < 0 ? 'down' : 'neutral',
        iconName: 'cost',
        description: "vs previous period"
      },
      {
        title: "Total Distance",
        value: `${totalDistance.toFixed(0)} km`,
        change: `${distanceChange > 0 ? '+' : ''}${distanceChange.toFixed(1)}%`,
        trend: distanceChange > 0 ? 'up' : distanceChange < 0 ? 'down' : 'neutral',
        iconName: 'distance',
        description: "vs previous period"
      },
      {
        title: "Fuel Efficiency",
        value: `${avgEfficiency.toFixed(1)} km/L`,
        change: "N/A",
        trend: 'neutral',
        iconName: 'efficiency',
        description: "Average consumption"
      }
    ];
  }, [filteredRecords, dateRange, comparisonPeriod, fuelRecords]);

  // Generate chart data
  const chartData = useMemo(() => {
    if (!filteredRecords.length) return null;

    // Group by date and calculate daily totals
    const dailyData = filteredRecords.reduce((acc, record) => {
      const date = record.sessionDate ? parseISO(record.sessionDate).toLocaleDateString() : 'Unknown';
      if (!acc[date]) {
        acc[date] = { fuel: 0, cost: 0, distance: 0 };
      }
      acc[date].fuel += record.fuelAmount || 0;
      acc[date].cost += record.totalCost || 0;
      acc[date].distance += record.distance || 0;
      return acc;
    }, {} as Record<string, { fuel: number; cost: number; distance: number }>);

    const labels = Object.keys(dailyData).sort();
    
    return {
      fuel: {
        labels,
        datasets: [{
          label: 'Fuel Consumption (L)',
          data: labels.map(date => dailyData[date].fuel),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
        }]
      },
      cost: {
        labels,
        datasets: [{
          label: 'Cost ($)',
          data: labels.map(date => dailyData[date].cost),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
        }]
      },
      distance: {
        labels,
        datasets: [{
          label: 'Distance (km)',
          data: labels.map(date => dailyData[date].distance),
          borderColor: 'rgb(168, 85, 247)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
        }]
      }
    };
  }, [filteredRecords]);

  return {
    dateRange,
    setDateRange,
    selectedVehicles,
    setSelectedVehicles,
    comparisonPeriod,
    setComparisonPeriod,
    filteredRecords,
    kpis,
    chartData,
    vehicles,
    drivers
  };
}
