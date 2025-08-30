import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VehicleTable } from "@/components/dashboard/vehicle-table"
import { AddVehicleModal } from "@/components/dashboard/add-vehicle-modal"
import { AddDriverModal } from "@/components/dashboard/add-driver-modal"
import { useVehicles } from "@/hooks/use-supabase-vehicles"
import { useDrivers } from "@/hooks/use-supabase-drivers"
import { Plus, Users, Car, Settings } from "lucide-react"
import { NavigationBar } from "@/components/NavigationBar"

export default function VehicleManagement() {
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false)
  const [showAddDriverModal, setShowAddDriverModal] = useState(false)
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([])
  
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles()
  const { data: drivers = [], isLoading: driversLoading } = useDrivers()

  if (vehiclesLoading || driversLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading vehicle management...</p>
        </div>
      </div>
    )
  }

  // Handler to adapt VehicleTable's onVehicleSelect signature
  // This function updates both local state and localStorage so that
  // the dashboard page can display selected vehicles in the Refuel Entry Table.
  const handleVehicleSelect = (vehicleIds: string[] | null) => {
    setSelectedVehicleIds(vehicleIds ?? []);
    // Sync selection to localStorage so dashboard can read it
    localStorage.setItem('selectedVehicles', JSON.stringify(vehicleIds ?? []));
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      {/* Main Content */}
      <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Vehicle Management</h1>
              <p className="text-muted-foreground mt-2">
                Manage your fleet vehicles, drivers, and assignments
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button onClick={() => setShowAddDriverModal(true)} variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Add Driver
              </Button>
              <Button onClick={() => setShowAddVehicleModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vehicles.length}</div>
              <p className="text-xs text-muted-foreground">
                Active fleet vehicles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{drivers.length}</div>
              <p className="text-xs text-muted-foreground">
                Registered drivers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Vehicles</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                                 {vehicles.filter(v => v.driver_id).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Vehicles with assigned drivers
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Vehicle Management Table */}
        {/*
          Vehicle selection here is for refueling. The selection is saved to localStorage,
          so the dashboard page can display the Refuel Entry Table for these vehicles only.
        */}
        <VehicleTable 
          vehicles={vehicles} 
          onAddVehicle={() => setShowAddVehicleModal(true)} 
          selectedVehicleIds={selectedVehicleIds}
          onVehicleSelect={handleVehicleSelect}
        />

        {/* Drivers Section */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Drivers</CardTitle>
                <Button onClick={() => setShowAddDriverModal(true)} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Driver
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drivers.map((driver) => (
                  <div key={driver.id} className="p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{driver.name}</h3>
                                                 <p className="text-sm text-muted-foreground">
                           {driver.license_number || "No license"}
                         </p>
                         {driver.phone_number && (
                           <p className="text-xs text-muted-foreground">
                             {driver.phone_number}
                           </p>
                         )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground">
                                                 Assigned Vehicles: {vehicles.filter(v => v.driver_id === driver.id).length}
                      </div>
                    </div>
                  </div>
                ))}
                
                {drivers.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No drivers registered yet. Add your first driver to get started.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Vehicle Modal */}
      <AddVehicleModal 
        open={showAddVehicleModal} 
        onOpenChange={setShowAddVehicleModal} 
      />

      {/* Add Driver Modal */}
      <AddDriverModal 
        open={showAddDriverModal} 
        onOpenChange={setShowAddDriverModal} 
      />
    </div>
  )
}