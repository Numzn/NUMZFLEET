import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useTheme } from "@/hooks/use-theme"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { BudgetSummary } from "@/components/dashboard/budget-summary"
import { ChartsSection } from "@/components/dashboard/charts-section"
import { AddFuelRecordModal } from "@/components/dashboard/add-fuel-record-modal"
import { useVehicles, useExportCSV, useDrivers, useFuelRecords } from "@/hooks/use-local-storage"
import { Calendar, Save, Bell, Sun, Moon, Fuel, User, PlusCircle, TrendingUp } from "lucide-react"

export default function Dashboard() {
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [showAddFuelRecordModal, setShowAddFuelRecordModal] = useState(false)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles()
  const { data: drivers = [], isLoading: driversLoading } = useDrivers()
  const { data: fuelRecords = [], isLoading: fuelRecordsLoading } = useFuelRecords()
  const exportCSVMutation = useExportCSV()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const isLoading = vehiclesLoading || driversLoading || fuelRecordsLoading

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

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary rounded-lg">
                  <Fuel className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Fleet Fuel Manager</h1>
                  <p className="text-sm text-muted-foreground">Dashboard</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={toggleTheme}>
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
              
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full"></span>
              </Button>
              
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header Actions */}
        <Card className="mb-8">
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

        {/* Stats Overview */}
        <div className="mb-8">
          <StatsCards vehicles={vehicles} />
        </div>

        {/* Main Dashboard Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          {/* Fuel Records Section */}
          <div className="xl:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Fuel className="h-5 w-5" />
                      <span>Recent Fuel Records</span>
                    </CardTitle>
                  </div>
                  <Button onClick={() => setShowAddFuelRecordModal(true)} size="sm">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Record
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {fuelRecords.length > 0 ? (
                  <div className="space-y-4">
                    {fuelRecords.slice(0, 8).map((record) => {
                      const vehicle = vehicles.find(v => v.id === record.vehicleId)
                      const driver = drivers.find(d => d.id === vehicle?.driverId)
                      return (
                        <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                              <Fuel className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{vehicle?.name || "Unknown Vehicle"}</p>
                              <p className="text-sm text-muted-foreground">
                                {driver?.name || "No driver"} • {new Date(record.sessionDate).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {record.fuelAmount}L • {record.attendant || "N/A"} • {record.pumpNumber || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${record.fuelCost.toFixed(2)}</p>
                            {record.fuelEfficiency && (
                              <p className="text-sm text-green-600">
                                <TrendingUp className="h-3 w-3 inline mr-1" />
                                {record.fuelEfficiency.toFixed(1)} km/L
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {record.currentMileage?.toLocaleString() || 0} km
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Fuel className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Fuel Records</h3>
                    <p className="text-muted-foreground mb-4">
                      Start tracking fuel consumption by adding your first record.
                    </p>
                    <Button onClick={() => setShowAddFuelRecordModal(true)}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add First Record
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Budget Summary & Quick Actions */}
          <div>
            <BudgetSummary vehicles={vehicles} />
          </div>
        </div>

        {/* Analytics Charts */}
        <ChartsSection vehicles={vehicles} />
      </main>

      {/* Add Fuel Record Modal */}
      <AddFuelRecordModal 
        open={showAddFuelRecordModal} 
        onOpenChange={setShowAddFuelRecordModal} 
      />
    </div>
  )
}
