import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useTheme } from "@/hooks/use-theme"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { BudgetSummary } from "@/components/dashboard/budget-summary"
import { ChartsSection } from "@/components/dashboard/charts-section"
import { AddFuelRecordModal } from "@/components/dashboard/add-fuel-record-modal"
import { VehicleTable } from "@/components/dashboard/vehicle-table"
import { RefuelEntryTable } from "@/components/dashboard/refuel-entry-table"
import { FuelRecordSummaryTable } from "@/components/dashboard/fuel-record-summary-table"
import { useVehicles as useSupabaseVehicles } from "@/hooks/use-supabase-vehicles"
import { useFuelRecords as useSupabaseFuelRecords } from "@/hooks/use-supabase-fuel-records"
import { useDrivers as useSupabaseDrivers } from "@/hooks/use-supabase-drivers"
import { useExportCSV } from "@/hooks/use-supabase-export-csv"
import { Calendar, Save, Bell, Sun, Moon, Fuel, User, PlusCircle, Car } from "lucide-react"
import React from "react"
import { DashboardMetricsCards } from "@/components/dashboard/dashboard-metrics-cards";


export default function Dashboard() {
  const [view, setView] = React.useState<"refueling" | "analytics">("refueling");
  
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [showAddFuelRecordModal, setShowAddFuelRecordModal] = useState(false)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(() => {
    // Initialize from localStorage
    const savedSelection = localStorage.getItem('selectedVehicles')
    return savedSelection ? new Set(JSON.parse(savedSelection)) : new Set()
  })
  
  const { data: vehicles = [], isLoading: vehiclesLoading } = useSupabaseVehicles()
  const { data: drivers = [], isLoading: driversLoading } = useSupabaseDrivers()
  const { data: fuelRecords = [], isLoading: fuelRecordsLoading } = useSupabaseFuelRecords()
  const exportCSVMutation = useExportCSV()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const isLoading = vehiclesLoading || driversLoading || fuelRecordsLoading

  // Update localStorage when selection changes
  useEffect(() => {
    localStorage.setItem('selectedVehicles', JSON.stringify(Array.from(selectedVehicles)))
  }, [selectedVehicles])

  // Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled) return

    const interval = setInterval(() => {
      const sessionData = {
        date: sessionDate,
        vehicles: vehicles,
        timestamp: new Date().toISOString(),
      }
      
      localStorage.setItem(`fuel-session-${sessionData.date}`, JSON.stringify(sessionData))
      console.log('Auto-saved session data')
    }, 30000) // Auto-save every 30 seconds

    return () => clearInterval(interval)
  }, [vehicles, sessionDate, autoSaveEnabled])

  // Clear selected vehicles in state when localStorage is cleared by RefuelEntryTable
  useEffect(() => {
    const onStorage = () => {
      const savedSelection = localStorage.getItem('selectedVehicles');
      if (!savedSelection || savedSelection === '[]') {
        setSelectedVehicles(new Set());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleSaveSession = () => {
    const sessionData = {
      date: sessionDate,
      vehicles: vehicles,
      excessAllocation: "", // This would come from the form
      totalBudget: vehicles.reduce((sum, v) => sum + v.budget, 0),
      totalActual: vehicles.reduce((sum, v) => sum + (v.actual || 0), 0),
      timestamp: new Date().toISOString(),
    }

    localStorage.setItem(`fuel-session-${sessionData.date}`, JSON.stringify(sessionData))
    toast({
      title: "Session Saved",
      description: "Your fuel session has been saved successfully.",
    })
  }

  const handleExportCSV = () => {
    exportCSVMutation.mutate()
  }

  const toggleAutoSave = () => {
    setAutoSaveEnabled(!autoSaveEnabled)
    toast({
      title: autoSaveEnabled ? "Auto-save Disabled" : "Auto-save Enabled",
      description: autoSaveEnabled 
        ? "Auto-save has been turned off." 
        : "Auto-save has been turned on. Data will be saved every 30 seconds.",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your fleet operations and monitor fuel consumption
          </p>
        </div>
        
        {/* Dashboard Toggle */}
        <div className="flex items-center bg-muted rounded-lg p-1">
          <Button
            variant={view === "refueling" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("refueling")}
            className="rounded-md"
          >
            <Fuel className="h-4 w-4 mr-2" />
            Refueling
          </Button>
          <Button
            variant={view === "analytics" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("analytics")}
            className="rounded-md"
          >
            <Car className="h-4 w-4 mr-2" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Conditional Dashboard Content */}
      {view === "refueling" ? (
        <div className="space-y-6">
          {/* Dashboard Header Actions */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <label className="text-sm font-medium">Session Date:</label>
                    <Input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={exportCSVMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    variant={autoSaveEnabled ? "default" : "outline"}
                    onClick={toggleAutoSave}
                    className={autoSaveEnabled ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {autoSaveEnabled ? "Auto-Save On" : "Auto-Save Off"}
                  </Button>
                  <Button onClick={handleSaveSession}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Session
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Smart Metrics Cards */}
          <DashboardMetricsCards onAddFuelRecord={() => setShowAddFuelRecordModal(true)} />
          
          {/* Stats Overview */}
          <StatsCards />
          
          {/* Bar Chart Section */}
          <Card>
            <CardHeader>
              <CardTitle>Fuel Spend by Vehicle</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartsSection />
            </CardContent>
          </Card>
          
          {/* Refuel Entry Table */}
          <Card>
            <CardHeader>
              <CardTitle>Refuel Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <RefuelEntryTable selectedVehicleIds={Array.from(selectedVehicles)} />
            </CardContent>
          </Card>
          
          {/* Fuel Record Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Fuel Record Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <FuelRecordSummaryTable />
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Analytics Dashboard */
        <AnalyticsDashboard />
      )}

      {/* Add Fuel Record Modal */}
      <AddFuelRecordModal 
        open={showAddFuelRecordModal} 
        onOpenChange={setShowAddFuelRecordModal} 
      />
    </div>
  )
}
