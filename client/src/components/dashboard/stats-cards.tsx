import { Card, CardContent } from "@/components/ui/card"
import { Wallet, CreditCard, TrendingUp, Car } from "lucide-react"
// TODO: Replace with Supabase hooks
// import { useFuelRecords } from "@/hooks/use-fuel-records"
// TODO: Replace with Supabase hooks
// import { useVehicles } from "@/hooks/use-vehicles"
import { useLastSessionSummary } from "./fuel-record-summary-table"
import { calculateFuelEfficiency } from "@/lib/utils";

export function StatsCards() {
  // TODO: Replace with Supabase hooks
  const { data: fuelRecords = [], isLoading: fuelLoading } = { data: [] as any[], isLoading: false };
  const { data: vehicles = [], isLoading: vehiclesLoading } = { data: [] as any[], isLoading: false };
  const { lastSessionDate, totalBudget, totalSpent, totalDifference, activeVehicles, isEmpty } = useLastSessionSummary(fuelRecords, vehicles);

  // Calculate overall fleet fuel efficiency
  let fleetEfficiency: { efficiency: number | null, type: 'L/100km' | 'L/month' | null } = { efficiency: null, type: null };
  if (fuelRecords.length > 0) {
    // Group by vehicleId, then aggregate
    const recordsByVehicle: Record<string, typeof fuelRecords> = {};
    for (const record of fuelRecords) {
      if (!recordsByVehicle[record.vehicleId]) recordsByVehicle[record.vehicleId] = [];
      recordsByVehicle[record.vehicleId].push(record);
    }
    // Calculate efficiency for each vehicle, then average
    const efficiencies: number[] = [];
    let type: 'L/100km' | 'L/month' | null = null;
    Object.values(recordsByVehicle).forEach(records => {
      const eff = calculateFuelEfficiency(records);
      if (eff.efficiency && eff.type) {
        efficiencies.push(eff.efficiency);
        type = eff.type; // Prefer L/100km if any vehicle has it
      }
    });
    if (efficiencies.length > 0) {
      fleetEfficiency = { efficiency: efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length, type };
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: 'ZMW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (fuelLoading || vehiclesLoading) {
    return <div className="h-32 flex items-center justify-center text-muted-foreground">Loading stats...</div>;
  }
  if (isEmpty) {
    return <div className="h-32 flex items-center justify-center text-muted-foreground">No session data available.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      <Card className="hover:shadow-xl transition-shadow border-0 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-black/10">
        <CardContent className="p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-1">Total Budget</p>
              <p className="text-3xl font-extrabold text-blue-900 dark:text-blue-100">{formatCurrency(totalBudget)}</p>
              <p className="text-xs text-emerald-600 mt-1">Last session: {lastSessionDate}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Wallet className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-xl transition-shadow border-0 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-black/10">
        <CardContent className="p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">Total Spent</p>
              <p className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">{formatCurrency(totalSpent)}</p>
              <p className={`text-xs mt-1 ${totalSpent <= totalBudget ? 'text-emerald-600' : 'text-red-600'}`}>{totalSpent <= totalBudget ? "Under budget" : "Over budget"}</p>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
              <CreditCard className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-xl transition-shadow border-0 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-black/10">
        <CardContent className="p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${totalDifference >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{totalDifference >= 0 ? "Savings" : "Over Budget"}</p>
              <p className={`text-3xl font-extrabold ${totalDifference >= 0 ? "text-emerald-700 dark:text-emerald-200" : "text-red-700 dark:text-red-200"}`}>{formatCurrency(Math.abs(totalDifference))}</p>
              <p className="text-xs text-muted-foreground mt-1">{totalBudget > 0 ? `${((Math.abs(totalDifference) / totalBudget) * 100).toFixed(1)}%` : "0%"}</p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
              <TrendingUp className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-xl transition-shadow border-0 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/40 dark:to-black/10">
        <CardContent className="p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300 mb-1">Refueled Vehicles</p>
              <p className="text-3xl font-extrabold text-purple-900 dark:text-purple-100">{activeVehicles}</p>
              <p className="text-xs text-muted-foreground mt-1">Cars refueled in session</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Car className="h-7 w-7 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Fleet Fuel Efficiency Card */}
      <Card className="hover:shadow-xl transition-shadow border-0 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/40 dark:to-black/10">
        <CardContent className="p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300 mb-1">Fleet Fuel Efficiency</p>
              <p className="text-3xl font-extrabold text-cyan-900 dark:text-cyan-100">
                {fleetEfficiency.efficiency !== null ? fleetEfficiency.efficiency.toFixed(1) : '--'}
                <span className="text-base font-normal ml-1">{fleetEfficiency.type || ''}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Avg. across all vehicles</p>
            </div>
            <div className="p-3 bg-cyan-100 dark:bg-cyan-900/20 rounded-lg">
              <TrendingUp className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
