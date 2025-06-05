import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Calculator, Upload, Plus, Bolt, FileText, Download, Edit, Trash, History } from "lucide-react"
import type { Vehicle } from "@shared/schema"

interface BudgetSummaryProps {
  vehicles: Vehicle[]
}

export function BudgetSummary({ vehicles }: BudgetSummaryProps) {
  const [excessAllocation, setExcessAllocation] = useState("")
  const [recentAllocations] = useState([
    { item: "Generator", amount: 450 },
    { item: "Maintenance", amount: 200 },
  ])

  const totalBudget = vehicles.reduce((sum, v) => sum + v.budget, 0)
  const totalActual = vehicles.reduce((sum, v) => sum + (v.actual || 0), 0)
  const totalSavings = totalBudget - totalActual

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const budgetUtilization = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0
  const avgCostPerVehicle = vehicles.length > 0 ? totalActual / vehicles.length : 0

  const handleRecordAllocation = () => {
    if (excessAllocation.trim()) {
      // This would typically save to backend
      console.log("Recording allocation:", excessAllocation)
      setExcessAllocation("")
    }
  }

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
            <h4 className="text-sm font-medium text-muted-foreground">Efficiency Metrics</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget Utilization:</span>
                <span className="font-medium">{budgetUtilization.toFixed(1)}%</span>
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

          {recentAllocations.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Recent Allocations</h4>
              <div className="space-y-2">
                {recentAllocations.map((allocation, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{allocation.item}</span>
                    <span className="font-medium">{formatCurrency(allocation.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Bolt className="h-5 w-5 text-purple-600 mr-2" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            <Edit className="h-4 w-4 mr-2" />
            Bulk Edit Actuals
          </Button>
          
          <Button variant="outline" className="w-full justify-start">
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          
          <Button variant="outline" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Email Summary
          </Button>
          
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
            <Trash className="h-4 w-4 mr-2" />
            Clear All Data
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <History className="h-5 w-5 text-muted-foreground mr-2" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-3 text-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span className="text-muted-foreground">Auto-save enabled</span>
            <span className="text-muted-foreground text-xs ml-auto">2 min ago</span>
          </div>
          
          <div className="flex items-center space-x-3 text-sm">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-muted-foreground">Session started</span>
            <span className="text-muted-foreground text-xs ml-auto">5 min ago</span>
          </div>
          
          <div className="flex items-center space-x-3 text-sm">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            <span className="text-muted-foreground">Dashboard loaded</span>
            <span className="text-muted-foreground text-xs ml-auto">10 min ago</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
