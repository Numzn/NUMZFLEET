import { Card, CardContent } from "@/components/ui/card"
import { Wallet, CreditCard, TrendingUp, Car } from "lucide-react"
import type { Vehicle } from "@shared/schema"

interface StatsCardsProps {
  vehicles: Vehicle[]
}

export function StatsCards({ vehicles }: StatsCardsProps) {
  const totalBudget = vehicles.reduce((sum, v) => sum + v.budget, 0)
  const totalActual = vehicles.reduce((sum, v) => sum + (v.actual || 0), 0)
  const totalDifference = totalBudget - totalActual
  const activeVehicles = vehicles.filter(v => v.isActive).length

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Budget</p>
              <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
              <p className="text-xs text-emerald-600">Current session</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold">{formatCurrency(totalActual)}</p>
              <p className="text-xs text-emerald-600">
                {totalActual <= totalBudget ? "Under budget" : "Over budget"}
              </p>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
              <CreditCard className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {totalDifference >= 0 ? "Savings" : "Over Budget"}
              </p>
              <p className={`text-2xl font-bold ${
                totalDifference >= 0 ? "text-emerald-600" : "text-red-600"
              }`}>
                {formatCurrency(Math.abs(totalDifference))}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalBudget > 0 ? `${((Math.abs(totalDifference) / totalBudget) * 100).toFixed(1)}%` : "0%"}
              </p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
              <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Vehicles</p>
              <p className="text-2xl font-bold">{activeVehicles}</p>
              <p className="text-xs text-muted-foreground">All operational</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Car className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
