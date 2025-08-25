import { Card, CardContent } from "@/components/ui/card";
import { Fuel, Wallet, Info, Car, PlusCircle } from "lucide-react";
import { useFuelRecords } from "@/hooks/use-fuel-records";
import { useVehicles } from "@/hooks/use-vehicles";
import { Badge } from "@/components/ui/badge";
import { DateTime } from "luxon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateFuelEfficiency } from "@/lib/utils";
import React from "react";

export function DashboardMetricsCards({ onAddFuelRecord }: { onAddFuelRecord?: () => void }) {
  const { data: vehicles = [] } = useVehicles();
  const { data: fuelRecords = [] } = useFuelRecords();

  // Vehicles Needing Refuel (21+ days)
  const vehiclesNeedingRefuel = vehicles.filter(vehicle => {
    const records = fuelRecords.filter(r => r.vehicleId === vehicle.id);
    if (records.length === 0) return false;
    const lastRefuel = records.reduce((latest, r) => {
      return new Date(r.sessionDate) > new Date(latest.sessionDate) ? r : latest;
    }, records[0]);
    const daysSince = Math.floor((Date.now() - new Date(lastRefuel.sessionDate).getTime()) / (1000 * 60 * 60 * 24));
    return daysSince >= 21;
  });

  // Total Fuel Spend (This Month)
  const now = DateTime.now();
  const startOfMonth = now.startOf('month');
  const totalFuelSpendThisMonth = fuelRecords
    .filter(r => DateTime.fromISO(r.sessionDate) >= startOfMonth)
    .reduce((sum, r) => sum + (r.fuelCost || 0), 0);

  // Best Fuel Efficiency (lowest L/100km) this month
  const startOfMonthISO = startOfMonth.toISODate();
  const vehiclesWithEfficiency = vehicles.map(vehicle => {
    const records = fuelRecords.filter(r => r.vehicleId === vehicle.id && DateTime.fromISO(r.sessionDate) >= startOfMonth);
    const eff = calculateFuelEfficiency(records);
    return { vehicle, ...eff };
  }).filter(v => v.efficiency !== null && v.type === 'L/100km');
  const bestEfficiency = vehiclesWithEfficiency.length > 0
    ? vehiclesWithEfficiency.reduce((best, curr) => curr.efficiency! < best.efficiency! ? curr : best)
    : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: 'ZMW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Vehicles Needing Refuel Card */}
      <Card className="hover:shadow-xl transition-shadow border-0 bg-gradient-to-br from-red-50 to-white dark:from-red-950/40 dark:to-black/10">
        <CardContent className="p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300 mb-1">Vehicles Needing Refuel</p>
              <p className="text-3xl font-extrabold text-red-900 dark:text-red-100">{vehiclesNeedingRefuel.length}</p>
              <p className="text-xs text-muted-foreground mt-1">21+ days since last refuel</p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <Fuel className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
          </div>
          {vehiclesNeedingRefuel.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {vehiclesNeedingRefuel.slice(0, 3).map(v => (
                <Badge key={v.id} variant="destructive">{v.name}</Badge>
              ))}
              {vehiclesNeedingRefuel.length > 3 && (
                <span className="text-xs text-muted-foreground">+{vehiclesNeedingRefuel.length - 3} more</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total Fuel Spend (This Month) Card */}
      <Card className="hover:shadow-xl transition-shadow border-0 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-black/10">
        <CardContent className="p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">Total Fuel Spend</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-1 cursor-pointer align-middle"><Info className="h-3 w-3 text-muted-foreground" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Sum of all fuel costs for the current calendar month.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">{formatCurrency(totalFuelSpendThisMonth)}</p>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
              <Wallet className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Fuel Efficiency Card */}
      <Card className="hover:shadow-xl transition-shadow border-0 bg-gradient-to-br from-green-50 to-white dark:from-green-950/40 dark:to-black/10">
        <CardContent className="p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-300 mb-1">Best Fuel Efficiency</p>
              <p className="text-3xl font-extrabold text-green-900 dark:text-green-100">
                {bestEfficiency ? `${bestEfficiency.efficiency!.toFixed(1)} L/100km` : '--'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {bestEfficiency ? bestEfficiency.vehicle.name : 'No data this month'}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Car className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Fuel Record Quick Action Card */}
      <Card className="hover:shadow-xl transition-shadow border-0 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-black/10 cursor-pointer" onClick={onAddFuelRecord}>
        <CardContent className="p-6 flex flex-col gap-2 items-center justify-center">
          <PlusCircle className="h-10 w-10 text-blue-600 dark:text-blue-400 mb-2" />
          <button
            className="text-lg font-bold text-blue-900 dark:text-blue-100 bg-blue-100 dark:bg-blue-900/20 px-4 py-2 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition"
            onClick={e => { e.stopPropagation(); onAddFuelRecord && onAddFuelRecord(); }}
            type="button"
          >
            Add Fuel Record
          </button>
          <p className="text-xs text-muted-foreground mt-1">Quickly log a new fuel entry</p>
        </CardContent>
      </Card>
    </div>
  );
} 