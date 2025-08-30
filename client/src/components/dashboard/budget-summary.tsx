import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Calculator, Upload, Plus, Bolt, FileText, Download, Edit, Trash, History, TrendingDown } from "lucide-react"
import type { Vehicle } from "@shared/schema"
import { useToast } from "@/hooks/use-toast"
import { trackEvent } from "@/lib/analytics"
import * as AnalyticsHelpers from "@/lib/analytics"

interface BudgetSummaryProps {
  vehicles: Vehicle[]
}

export function BudgetSummary({ vehicles }: BudgetSummaryProps) {
  const [excessAllocation, setExcessAllocation] = useState("")
  const { toast } = useToast()
  
  const totalBudget = vehicles.reduce((sum, vehicle) => sum + vehicle.budget, 0)
  const totalActual = vehicles.reduce((sum, vehicle) => sum + (vehicle.actual || 0), 0)
  const totalSavings = totalBudget - totalActual
  const percentageUsed = Math.min(totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0, 100)

  const handleRecordAllocation = () => {
    try {
      // Track the allocation event
      AnalyticsHelpers.trackPageView('record_allocation')
      
      toast({
        title: "Allocation Recorded",
        description: "Your excess fund allocation has been saved.",
      })
      
      // Clear the input after successful recording
      setExcessAllocation("")
    } catch (error) {
      toast({
        title: "Failed to Record",
        description: "Could not save your allocation. Please try again.",
        variant: "destructive"
      })
      AnalyticsHelpers.trackError("Record Allocation", error instanceof Error ? error.message : "Unknown error")
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

  const budgetUtilization = Math.min(totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0, 100)
  const avgCostPerVehicle = vehicles.length > 0 ? totalActual / vehicles.length : 0

  return (
    <div className="space-y-6">
      {/* Budget Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Calculator className="h-5 w-5 text-primary mr-2" />
            Budget Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium text-muted-foreground">Total Budget:</span>
            <span className="font-semibold">{formatCurrency(totalBudget)}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium text-muted-foreground">Total Actual:</span>
            <span className="font-semibold">{formatCurrency(totalActual)}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {totalSavings >= 0 ? "Under Budget:" : "Over Budget:"}
            </span>
            <span className={`font-bold ${totalSavings >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {formatCurrency(Math.abs(totalSavings))}
            </span>
          </div>

          <div className="pt-4 border-t space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Budget Progress</h4>
            <Progress value={percentageUsed} />
            <div className="text-xs text-muted-foreground text-right">{percentageUsed}% used</div>
          </div>

          <div className="pt-4 border-t space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Efficiency Metrics</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget Utilization:</span>
                <span className="font-medium">{budgetUtilization}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg. Cost per Vehicle:</span>
                <span className="font-medium">{formatCurrency(avgCostPerVehicle)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Excess Allocation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Upload className="h-5 w-5 text-amber-600 mr-2" />
            Excess Allocation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Allocate Excess Funds:
            </label>
            <Textarea
              placeholder="e.g., Generator - $650, Office supplies - $100"
              value={excessAllocation}
              onChange={(e) => setExcessAllocation(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          
          <Button 
            onClick={handleRecordAllocation}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!excessAllocation.trim()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Record Allocation
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
