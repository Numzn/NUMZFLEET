import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { insertFuelRecordSchema } from "@shared/schema"
import type { InsertFuelRecord } from "@shared/schema"
import { useCreateFuelRecord } from "@/hooks/use-fuel-records"
import { useVehicles } from "@/hooks/use-vehicles"
import { useDrivers } from "@/hooks/use-drivers"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

interface AddFuelRecordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicleId?: number
}

export function AddFuelRecordModal({ open, onOpenChange, vehicleId }: AddFuelRecordModalProps) {
  const createFuelRecordMutation = useCreateFuelRecord()
  const { data: vehicles = [] } = useVehicles()
  const { data: drivers = [] } = useDrivers()
  
  const selectedVehicle = vehicleId ? vehicles.find(v => v.id === vehicleId) : null

  const form = useForm<InsertFuelRecord>({
    resolver: zodResolver(insertFuelRecordSchema),
    defaultValues: {
      vehicleId: vehicleId || 0,
      driverId: undefined,
      sessionDate: new Date().toISOString().split('T')[0],
      previousMileage: selectedVehicle?.currentMileage || 0,
      currentMileage: 0,
      distanceTraveled: 0,
      fuelAmount: 0,
      fuelCost: 0,
      fuelEfficiency: 0,
      attendant: "",
      pumpNumber: "",
      notes: "",
    },
  })

  const watchedPreviousMileage = form.watch("previousMileage")
  const watchedCurrentMileage = form.watch("currentMileage")
  const watchedFuelAmount = form.watch("fuelAmount")

  const onSubmit = async (data: InsertFuelRecord) => {
    try {
      await createFuelRecordMutation.mutateAsync(data)
      form.reset()
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  // Calculate distance when mileage changes
  const handleMileageChange = () => {
    const distance = watchedCurrentMileage - watchedPreviousMileage
    if (distance >= 0) {
      form.setValue("distanceTraveled", distance)
      if (watchedFuelAmount > 0) {
        form.setValue("fuelEfficiency", distance / watchedFuelAmount)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Fuel Record</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    value={field.value?.toString() || ""}
                    disabled={!!vehicleId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a vehicle" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                          {vehicle.name} ({vehicle.plateNumber || "No plate"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="driverId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Driver (Optional)</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))} 
                    value={field.value?.toString() || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a driver" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No driver specified</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id.toString()}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sessionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="previousMileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previous Mileage (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="1" 
                        placeholder="25000"
                        {...field}
                        onChange={(e) => {
                          field.onChange(parseFloat(e.target.value) || 0)
                          setTimeout(handleMileageChange, 0)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentMileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Mileage (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="1" 
                        placeholder="25100"
                        {...field}
                        onChange={(e) => {
                          field.onChange(parseFloat(e.target.value) || 0)
                          setTimeout(handleMileageChange, 0)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fuelAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuel Amount (L)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.1" 
                        placeholder="45.5"
                        {...field}
                        onChange={(e) => {
                          field.onChange(parseFloat(e.target.value) || 0)
                          setTimeout(handleMileageChange, 0)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fuelCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuel Cost ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        placeholder="75.50"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="attendant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attendant</FormLabel>
                    <FormControl>
                      <Input placeholder="Attendant name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pumpNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pump Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Pump #" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this fuel record..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Distance Traveled:</span>
                  <span className="font-medium">{(watchedCurrentMileage - watchedPreviousMileage).toFixed(0)} km</span>
                </div>
                <div className="flex justify-between">
                  <span>Fuel Efficiency:</span>
                  <span className="font-medium">
                    {watchedFuelAmount > 0 ? ((watchedCurrentMileage - watchedPreviousMileage) / watchedFuelAmount).toFixed(2) : "0.00"} km/L
                  </span>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={createFuelRecordMutation.isPending}
              >
                {createFuelRecordMutation.isPending ? "Adding..." : "Add Record"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}