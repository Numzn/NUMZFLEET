import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, subMonths } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

interface ReportFiltersProps {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  selectedVehicles: string[];
  setSelectedVehicles: (vehicles: string[]) => void;
  comparisonPeriod: 'week' | 'month' | 'quarter';
  setComparisonPeriod: (period: 'week' | 'month' | 'quarter') => void;
  vehicles: any[];
}

export function ReportFilters({
  dateRange,
  setDateRange,
  selectedVehicles,
  setSelectedVehicles,
  comparisonPeriod,
  setComparisonPeriod,
  vehicles,
}: ReportFiltersProps) {
  const handleQuickDateRange = (months: number) => {
    setDateRange({
      from: subMonths(new Date(), months),
      to: new Date(),
    });
  };

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicles(prev =>
      prev.includes(vehicleId)
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId]
    );
  };

  return (
    <div className="space-y-4">
      {/* Date Range Selection */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Quick Date Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickDateRange(1)}
          >
            Last Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickDateRange(3)}
          >
            Last 3 Months
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickDateRange(6)}
          >
            Last 6 Months
          </Button>
        </div>
      </div>

      {/* Comparison Period */}
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium">Compare with:</span>
        <Select value={comparisonPeriod} onValueChange={(value: any) => setComparisonPeriod(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Previous Week</SelectItem>
            <SelectItem value="month">Previous Month</SelectItem>
            <SelectItem value="quarter">Previous Quarter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vehicle Filter */}
      <div className="space-y-2">
        <span className="text-sm font-medium">Filter by Vehicles:</span>
        <div className="flex flex-wrap gap-2">
          {vehicles.map((vehicle) => (
            <Button
              key={vehicle.id}
              variant={selectedVehicles.includes(vehicle.id) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleVehicle(vehicle.id)}
            >
              {vehicle.name}
            </Button>
          ))}
          {selectedVehicles.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedVehicles([])}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

