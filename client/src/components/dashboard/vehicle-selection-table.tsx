import { useState } from "react"
import { Check } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useVehicles } from "@/hooks/use-supabase-vehicles"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface VehicleSelectionTableProps {
  selectedVehicles: Set<string>;
  setSelectedVehicles: (vehicles: Set<string>) => void;
}

export function VehicleSelectionTable({ selectedVehicles, setSelectedVehicles }: VehicleSelectionTableProps) {
  const { data: vehicles = [] } = useVehicles()

  const toggleVehicle = (vehicleId: string) => {
    const newSelected = new Set(selectedVehicles)
    if (newSelected.has(vehicleId)) {
      newSelected.delete(vehicleId)
    } else {
      newSelected.add(vehicleId)
    }
    setSelectedVehicles(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedVehicles.size === vehicles.length) {
      setSelectedVehicles(new Set())
    } else {
      setSelectedVehicles(new Set(vehicles.map(v => v.id)))
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Select Vehicles</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSelectAll}
          >
            {selectedVehicles.size === vehicles.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Fuel Type</TableHead>
                <TableHead className="text-right">Budget (ZMW)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => {
                const isSelected = selectedVehicles.has(vehicle.id)
                                 const style = {
                   backgroundColor: vehicle.fuel_type?.toLowerCase() === 'diesel' ? 'rgb(243 232 255)' : 
                                 vehicle.fuel_type?.toLowerCase() === 'petrol' ? 'rgb(220 252 231)' : 
                                 'transparent'
                 }

                return (
                  <TableRow 
                    key={vehicle.id} 
                    style={style}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      isSelected && "bg-muted/50"
                    )}
                    onClick={() => toggleVehicle(vehicle.id)}
                  >
                    <TableCell>
                      <div className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center",
                        isSelected && "bg-primary border-primary"
                      )}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{vehicle.name}</TableCell>
                    <TableCell>{vehicle.type}</TableCell>
                                         <TableCell>{vehicle.fuel_type || 'N/A'}</TableCell>
                     <TableCell className="text-right">{(vehicle.budget || 0).toLocaleString()}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
