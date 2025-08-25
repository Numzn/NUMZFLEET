import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, Edit, Trash2, Car, Fuel, User, MapPin } from "lucide-react"
import type { Vehicle } from "@shared/schema"
import { useUpdateVehicle, useDeleteVehicle } from "@/hooks/use-vehicles"
import { useDrivers } from "@/hooks/use-drivers"
import { useFuelRecords } from "@/hooks/use-fuel-records";
import { calculateFuelEfficiency } from "@/lib/utils";
import { cn } from "@/lib/utils"

interface VehicleTableProps {
  vehicles: Vehicle[]
  onAddVehicle: () => void
  onVehicleSelect?: (vehicleIds: string[] | null) => void
  selectedVehicleIds?: string[]
}

export function VehicleTable({ vehicles, onAddVehicle, onVehicleSelect, selectedVehicleIds }: VehicleTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterValue, setFilterValue] = useState("all")
  const [editingRow, setEditingRow] = useState<{ id: string, field: 'mileage' | 'budget' } | null>(null)
  // Only use internal state if not controlled
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set())
  const isControlled = typeof selectedVehicleIds !== 'undefined'
  const selectedVehicles = isControlled ? new Set(selectedVehicleIds) : internalSelected

  const { mutateAsync: updateVehicle } = useUpdateVehicle()
  const deleteVehicleMutation = useDeleteVehicle()
  const { data: drivers = [] } = useDrivers()
  const { data: fuelRecords = [] } = useFuelRecords();

  const filteredVehicles = useMemo(() => {
    let filtered = vehicles;

    switch (filterValue) {
      case "plate":
        filtered = filtered.filter(vehicle =>
          (vehicle.registrationNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
        )
        break
      case "driver":
        filtered = filtered.filter(vehicle => {
          const driver = drivers.find(d => d.id === vehicle.driverId)
          return (driver?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
        })
        break
      case "name":
        filtered = filtered.filter(vehicle =>
          vehicle.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        break
      default:
        filtered = filtered.filter(vehicle =>
          vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vehicle.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (vehicle.registrationNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (drivers.find(d => d.id === vehicle.driverId)?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
        )
    }

    return filtered
  }, [vehicles, searchTerm, filterValue, drivers])

  const handleEdit = (vehicleId: string, field: 'mileage' | 'budget') => {
    setEditingRow({ id: vehicleId, field })
  }

  const handleEditSave = async (vehicleId: string, field: string, value: string) => {
    const numberValue = parseFloat(value) || 0
    const updates = field === 'mileage' 
      ? { currentMileage: numberValue }
      : { budget: numberValue }

    await updateVehicle({ 
      id: vehicleId, 
      updates 
    })
    setEditingRow(null)
  }  // Handle vehicle selection
  const handleSelectForRefuel = (vehicleId: string, event?: React.MouseEvent) => {
    event?.preventDefault()
    
    setSelectedVehicles(prev => {
      const newSelection = new Set(prev)
      
      // Case 1: Toggle mode - Ctrl/Cmd is pressed or "Select All" is active
      if (event?.ctrlKey || event?.metaKey) {
        // Simple toggle for Ctrl/Cmd clicks
        return new Set(
          newSelection.has(vehicleId) 
            ? Array.from(newSelection).filter(id => id !== vehicleId)
            : Array.from(newSelection).concat(vehicleId)
        )
      }
      
      // Case 2: Range Selection - Shift is pressed and there are existing selections
      if (event?.shiftKey && prev.size > 0) {
        const vehicleIds = filteredVehicles.map(v => v.id) // Use filtered list for range
        const lastSelected = Array.from(prev)[prev.size - 1]
        const startIdx = vehicleIds.indexOf(lastSelected)
        const endIdx = vehicleIds.indexOf(vehicleId)
        
        // Get the range of IDs and add them to existing selection
        const range = vehicleIds.slice(
          Math.min(startIdx, endIdx),
          Math.max(startIdx, endIdx) + 1
        )
        range.forEach(id => newSelection.add(id))
        return newSelection
      }
      
      // Case 3: Toggle single item if all are selected
      if (prev.size === filteredVehicles.length && prev.has(vehicleId)) {
        newSelection.delete(vehicleId)
        return newSelection
      }
      
      // Case 4: Additive Selection - No modifiers, not all selected
      if (!event?.ctrlKey && !event?.metaKey && !event?.shiftKey) {
        // If the clicked item is already selected, just toggle it off
        if (prev.size === 1 && prev.has(vehicleId)) {
          return new Set()
        }
        // If clicking an unselected item, add it to selection
        if (!prev.has(vehicleId)) {
          newSelection.add(vehicleId)
          return newSelection
        }
      }
      
      // Default case: Clear and select single
      return new Set([vehicleId])
    })
  }

  // Helper to update selection
  const setSelectedVehicles = (updater: (prev: Set<string>) => Set<string>) => {
    if (isControlled && onVehicleSelect) {
      const next = updater(new Set(selectedVehicleIds))
      onVehicleSelect(Array.from(next))
    } else {
      setInternalSelected(updater)
    }
  }

  const handleDeleteVehicle = async (vehicleId: string) => {
    const result = window.confirm("Are you sure you want to delete this vehicle? This action cannot be undone.")
    if (result) {
      try {
        await deleteVehicleMutation.mutateAsync(vehicleId)
      } catch (error) {
        console.error('Failed to delete vehicle:', error)
      }
    }
  }

  const getDriverName = (driverId: string | undefined) => {
    if (!driverId) return "Unassigned"
    const driver = drivers.find(d => d.id === driverId)
    return driver ? driver.name : "Unknown Driver"
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: 'ZMW',
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

  const handleSelectAll = () => {
    setSelectedVehicles(prev => {
      // If all filtered vehicles are selected, deselect all
      const allSelected = filteredVehicles.every(v => prev.has(v.id))
      if (allSelected) {
        return new Set()
      }
      // Otherwise, select all filtered vehicles
      return new Set(filteredVehicles.map(v => v.id))
    })
  }

  // Helper to get fuel efficiency for a vehicle
  const getVehicleEfficiency = (vehicleId: string) => {
    const records = fuelRecords.filter(r => r.vehicleId === vehicleId);
    return calculateFuelEfficiency(records);
  };

  // Helper to get last refuel date for a vehicle
  const getLastRefuelDate = (vehicleId: string) => {
    const records = fuelRecords.filter(r => r.vehicleId === vehicleId);
    if (records.length === 0) return null;
    const sorted = [...records].sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
    return sorted[0].sessionDate;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-lg font-semibold">Vehicle Fleet</h2>
            <p className="text-sm text-muted-foreground">Manage driver allocation and tracking</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="vehicle-search"
                name="vehicle-search"
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
                <SelectItem value="plate">By Plate</SelectItem>
                <SelectItem value="driver">By Driver</SelectItem>
                <SelectItem value="name">By Car Name</SelectItem>              </SelectContent>
            </Select>
            
            <Button onClick={onAddVehicle} className="whitespace-nowrap">
              <Plus className="h-4 w-4 mr-2" />
              Register Vehicle
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <div className="mb-4 text-sm text-muted-foreground flex justify-between items-center">
            <div>
              {selectedVehicles.size > 0 ? (
                <p>
                  {selectedVehicles.size} vehicle(s) selected
                  <span className="ml-2 text-xs">
                    (Use Ctrl/Cmd+Click to toggle selection, Shift+Click for range selection)
                  </span>
                </p>
              ) : (
                <p>Click the fuel icon to select vehicles for refueling</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="ml-4"
            >
              {filteredVehicles.every(v => selectedVehicles.has(v.id))
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Mileage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Fuel Efficiency
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  GPS Tracking
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredVehicles.map((vehicle) => {
                const eff = getVehicleEfficiency(vehicle.id);
                return (
                  <tr 
                    key={vehicle.id} 
                    className={cn(
                      "transition-colors",
                      selectedVehicles.has(vehicle.id) 
                        ? "bg-primary/5 hover:bg-primary/10" 
                        : "hover:bg-muted/50"
                    )}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-3">
                        {getVehicleIcon(vehicle.type)}
                        <div>
                          <p className="text-sm font-medium">{vehicle.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.registrationNumber || "No plate"} • {vehicle.type} • {vehicle.fuelType || "N/A"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Capacity: {vehicle.fuelCapacity || "N/A"}L
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{getDriverName(vehicle.driverId)}</p>
                          {vehicle.driverId && (
                            <p className="text-xs text-muted-foreground">Assigned</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">                    {editingRow?.id === vehicle.id && editingRow.field === 'mileage' ? (
                      <Input
                        id={`mileage-${vehicle.id}`}
                        name={`mileage-${vehicle.id}`}
                        type="number"
                        defaultValue={vehicle.currentMileage || 0}
                        className="w-24 h-8"
                        onBlur={(e) => handleEditSave(vehicle.id, 'mileage', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEditSave(vehicle.id, 'mileage', e.currentTarget.value)}
                        autoFocus
                      />
                    ) : (
                      <div onClick={() => handleEdit(vehicle.id, 'mileage')} className="cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <p className="text-sm font-medium">{(vehicle.currentMileage || 0).toLocaleString()} km</p>
                        <p className="text-xs text-muted-foreground">Click to edit</p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">                    {editingRow?.id === vehicle.id && editingRow.field === 'budget' ? (
                      <Input
                        id={`budget-${vehicle.id}`}
                        name={`budget-${vehicle.id}`}
                        type="number"
                        defaultValue={vehicle.budget}
                        className="w-24 h-8"
                        onBlur={(e) => handleEditSave(vehicle.id, 'budget', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEditSave(vehicle.id, 'budget', e.currentTarget.value)}
                        autoFocus
                      />
                    ) : (
                      <div onClick={() => handleEdit(vehicle.id, 'budget')} className="cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <p className="text-sm font-medium">{formatCurrency(vehicle.budget)}</p>
                        <p className="text-xs text-muted-foreground">Click to edit</p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {eff.efficiency !== null ? `${eff.efficiency.toFixed(1)} ${eff.type}` : <span className="text-xs text-muted-foreground">N/A</span>}
                    {/* Refuel Reminder Badge */}
                    {(() => {
                      const lastRefuel = getLastRefuelDate(vehicle.id);
                      if (lastRefuel) {
                        const daysSince = Math.floor((Date.now() - new Date(lastRefuel).getTime()) / (1000 * 60 * 60 * 24));
                        if (daysSince >= 21) {
                          return (
                            <Badge variant="destructive" className="ml-2 mt-1">Refuel Due! ({daysSince} days)</Badge>
                          );
                        }
                      }
                      return null;
                    })()}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      {vehicle.traccarDeviceId ? (
                        <>
                          <Badge variant="default" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            Device {vehicle.traccarDeviceId}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            asChild
                          >
                            <a href={`/tracking?vehicle=${vehicle.id}`}>
                              Track
                            </a>
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            No Device
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            asChild
                          >
                            <a href="/traccar-admin">
                              Assign
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-1">
                      <Button
                        variant={selectedVehicles.has(vehicle.id) ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-8 w-8 p-0",
                          selectedVehicles.has(vehicle.id)
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "text-blue-600 hover:text-blue-700"
                        )}
                        onClick={(e) => handleSelectForRefuel(vehicle.id, e)}
                        title="Click to select, Ctrl+Click to toggle, Shift+Click for range"
                      >
                        <Fuel className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        disabled={deleteVehicleMutation.isPending}
                        title="Delete vehicle"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )})}
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
            {selectedVehicles.size > 0 && ` • ${selectedVehicles.size} selected`}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
