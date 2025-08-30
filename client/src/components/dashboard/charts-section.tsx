import { useState, useMemo, useEffect } from "react"
// TODO: Replace with Supabase hooks
// import { useFuelRecords } from "@/hooks/use-fuel-records"
// TODO: Replace with Supabase hooks
// import { useVehicles } from "@/hooks/use-vehicles"
import { DateTime } from "luxon"
import { Bar } from "react-chartjs-2"
import { Card, CardContent } from "@/components/ui/card"
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip as ChartJSTooltip,
  Legend
} from "chart.js"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

ChartJS.register(BarElement, CategoryScale, LinearScale, ChartJSTooltip, Legend)

export function ChartsSection() {
  // TODO: Replace with Supabase hooks
  const { data: fuelRecords = [] } = { data: [] as any[] }
  const { data: vehicles = [] } = { data: [] as any[] }

  // Group records by month (YYYY-MM)
  const recordsByMonth = useMemo(() => {
    const groups: Record<string, typeof fuelRecords> = {};
    for (const record of fuelRecords) {
      const monthKey = DateTime.fromISO(record.sessionDate).toFormat('yyyy-MM');
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(record);
    }
    return groups;
  }, [fuelRecords]);

  const months = Object.keys(recordsByMonth).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const totalSpendByMonth = months.map(month =>
    recordsByMonth[month].reduce((sum, r) => sum + (r.fuelCost || 0), 0)
  );

  const chartData = useMemo(() => ({
    labels: months.map(m => DateTime.fromFormat(m, 'yyyy-MM').toFormat('LLL yyyy')),
    datasets: [
      {
        label: "Total Spend",
        data: totalSpendByMonth,
        backgroundColor: "#1e3a8a",
        borderRadius: 4,
      },
    ],
  }), [months, totalSpendByMonth]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#f9fafb",
        titleColor: "#111827",
        bodyColor: "#1f2937",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        padding: 10,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#6b7280",
          font: { size: 13, weight: 600 }
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: "#e5e7eb" },
        title: {
          display: true,
          text: "Amount (ZMW)",
          color: "#374151",
          font: { size: 13, weight: 600 }
        },
        ticks: { color: "#6b7280" },
      }
    }
  };

  if (!months.length) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        No monthly data to display.
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <Card className="shadow-md rounded-xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-semibold text-gray-700">Fuel Spend Trend</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-1 cursor-pointer align-middle"><Info className="h-4 w-4 text-muted-foreground" /></span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Shows total fuel spend for each month. Useful for spotting trends and budgeting.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-xs text-muted-foreground mb-2">Bar chart of total fuel spend by month</div>
          <div className="h-[320px]">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
