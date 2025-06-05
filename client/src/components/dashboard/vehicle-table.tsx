import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, Edit, Trash2, Car } from "lucide-react"
import type { Vehicle } from "@shared/schema"
import { useUpdateVehicle, useDeleteVehicle } from "@/hooks/use-vehicles"

interface VehicleTableProps {
  vehicles: Vehicle[]
  onAddVehicle: () => void
}

export function VehicleTable({ vehicles, onAddVehicle }: VehicleTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterValue, setFilterValue] = useState("all")
  
  const updateVehicleMutation = useUpdateVehicle()
  const deleteVehicleMutation = useDeleteVehicle()

  const filteredVehicles = useMemo(() => {
    let filtered = vehicles.filter(vehicle =>
      vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vehicle.plateNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    switch (filterValue) {
      case "over-budget":
        filtered = filtered.filter(v => (v.actual || 0) > v.budget)
        break
      case "under-budget":
        filtered = filtered.filter(v => (v.actual || 0) < v.budget)
        break
      case "on-track":
        filtered = filtered.filter(v => Math.abs((v.actual || 0) - v.budget) < v.budget * 0.1)
        break
    }

    return filtered
  }, [vehicles, searchTerm, filterValue])

  const handleActualChange = (vehicleId: number, value: string) => {
    const actual = parseFloat(value) || 0
    updateVehicleMutation.mutate({ id: vehicleId, updates: { actual } })
  }

  const handleAttendantChange = (vehicleId: number, value: string) => {
    updateVehicleMutation.mutate({ id: vehicleId, updates: { attendant: value } })
  }

  const handlePumpChange = (vehicleId: number, value: string) => {
    updateVehicleMutation.mutate({ id: vehicleId, updates: { pump: value } })
  }

  const handleDeleteVehicle = (vehicleId: number) => {
    if (confirm("Are you sure you want to delete this vehicle?")) {
      deleteVehicleMutation.mutate(vehicleId)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getVarianceBadge = (budget: number, actual: number) => {
    const variance = budget - actual
    const isPositive = variance >= 0

    return (
      <Badge variant={isPositive ? "default" : "destructive"}>
        {isPositive ? "+" : ""}{formatCurrency(variance)}
      </Badge>
    )
  }

  const getVehicleIcon = (type: string) => {
    const colorClasses = {
      sedan: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
      compact: "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400",
      hatchback: "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
      suv: "bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
      truck: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    }

    return (
      <div className={`p-2 rounded-lg ${colorClasses[type as keyof typeof colorClasses] || colorClasses.sedan}`}>
        <Car className="h-4 w-4" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-lg font-semibold">Vehicle Fleet</h2>
            <p className="text-sm text-muted-foreground">Manage fuel allocation and tracking</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vehicles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-auto"
              />
            </div>
            
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-full sm:w-auto">
                <SelectValue placeholder="Filter vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                <SelectItem value="over-budget">Over Budget</SelectItem>
                <SelectItem value="under-budget">Under Budget</SelectItem>
                <SelectItem value="on-track">On Track</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={onAddVehicle} className="whitespace-nowrap">
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actual
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Attendant
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pump
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Variance
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-3">
                      {getVehicleIcon(vehicle.type)}
                      <div>
                        <p className="text-sm font-medium">{vehicle.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {vehicle.plateNumber || "No plate"} • {vehicle.type}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-medium">{formatCurrency(vehicle.budget)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={vehicle.actual || ""}
                      onChange={(e) => handleActualChange(vehicle.id, e.target.value)}
                      className="w-24"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Input
                      type="text"
                      value={vehicle.attendant || ""}
                      onChange={(e) => handleAttendantChange(vehicle.id, e.target.value)}
                      className="w-28"
                      placeholder="Attendant"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Input
                      type="text"
                      value={vehicle.pump || ""}
                      onChange={(e) => handlePumpChange(vehicle.id, e.target.value)}
                      className="w-16"
                      placeholder="Pump"
                    />
                  </td>
                  <td className="px-4 py-4">
                    {getVarianceBadge(vehicle.budget, vehicle.actual || 0)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          // Edit functionality could be added here
                          console.log("Edit vehicle:", vehicle.id)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        disabled={deleteVehicleMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredVehicles.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No vehicles found matching your criteria.</p>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {filteredVehicles.length} of {vehicles.length} vehicles
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              1
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
