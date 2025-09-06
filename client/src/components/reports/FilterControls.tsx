import React from "react";
import { DateRangePicker, DateRange } from "./DateRangePicker";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface FilterControlsProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  selectedVehicles: string[];
  onVehicleSelectionChange: (vehicles: string[]) => void;
  comparisonPeriod: 'week' | 'month' | 'quarter';
  onComparisonPeriodChange: (period: 'week' | 'month' | 'quarter') => void;
  vehicles: any[];
  onExport?: () => void;
  className?: string;
}

export function FilterControls({
  dateRange,
  onDateRangeChange,
  selectedVehicles,
  onVehicleSelectionChange,
  comparisonPeriod,
  onComparisonPeriodChange,
  vehicles,
  onExport,
  className
}: FilterControlsProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Date Range and Export */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
        />
        {onExport && (
          <Button onClick={onExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        )}
      </div>

      {/* Vehicle Selection and Comparison Period */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Vehicle Selection */}
        <div className="flex-1 min-w-0">
          <label className="text-sm font-medium mb-2 block">Filter by Vehicles</label>
          <Select
            value={selectedVehicles.length === 0 ? "all" : "custom"}
            onValueChange={(value) => {
              if (value === "all") {
                onVehicleSelectionChange([]);
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select vehicles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.name || vehicle.registrationNumber || `Vehicle ${vehicle.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Comparison Period */}
        <div className="w-full sm:w-48">
          <label className="text-sm font-medium mb-2 block">Comparison Period</label>
          <Select
            value={comparisonPeriod}
            onValueChange={(value: 'week' | 'month' | 'quarter') => 
              onComparisonPeriodChange(value)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week over Week</SelectItem>
              <SelectItem value="month">Month over Month</SelectItem>
              <SelectItem value="quarter">Quarter over Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}


