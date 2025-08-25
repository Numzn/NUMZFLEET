import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { insertVehicleSchema } from "@shared/schema"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { useCreateVehicle } from "@/hooks/use-vehicles"
import { useToast } from "@/hooks/use-toast"
import { useDrivers } from "@/hooks/use-drivers"
import { Loader2 } from "lucide-react"
import { z } from "zod"

type FormData = z.infer<typeof insertVehicleSchema>

interface AddVehicleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddVehicleModal({ open, onOpenChange }: AddVehicleModalProps) {
  const { data: drivers = [] } = useDrivers()
  const { mutate: createVehicle, isPending } = useCreateVehicle()
  const { toast } = useToast()

  const form = useForm<FormData>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: {
      name: "",
      type: "sedan",
      registrationNumber: "",
      model: "",
      budget: 0,
      fuelType: "petrol",
      fuelCapacity: 50,
      currentMileage: 0,
      driverId: undefined,
      isActive: true,
      actual: 0,
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      createVehicle(data, {
        onSuccess: () => {
          form.reset()
          onOpenChange(false)
          toast({
            title: "Success",
            description: "Vehicle has been added successfully."
          })
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: "Failed to add vehicle. Please try again.",
            variant: "destructive"
          })
        }
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add vehicle. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleCancel = () => {
    if (!isPending) {
      form.reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Vehicle</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="name">Vehicle Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      id="name"
                      placeholder="e.g. Toyota Corolla"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="model">Model</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="model"
                        placeholder="e.g. 2023"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="type">Type</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="type">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sedan">Sedan</SelectItem>
                          <SelectItem value="suv">SUV</SelectItem>
                          <SelectItem value="truck">Truck</SelectItem>
                          <SelectItem value="van">Van</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="registrationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="registration">Registration Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="registration"
                        placeholder="e.g. ABC-123"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="driver">Assigned Driver</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <SelectTrigger id="driver">
                          <SelectValue placeholder="Select Driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fuelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="fuelType">Fuel Type</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value ?? "petrol"}>
                        <SelectTrigger id="fuelType">
                          <SelectValue placeholder="Select Fuel Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="petrol">Petrol</SelectItem>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="electric">Electric</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fuelCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="fuelCapacity">Fuel Tank Capacity (L)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="fuelCapacity"
                        type="number"
                        min={0}
                        step={0.1}
                        placeholder="e.g. 50.0"
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
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
                name="currentMileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="currentMileage">Current Mileage (km)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="currentMileage"
                        type="number"
                        min={0}
                        step={1}
                        placeholder="e.g. 50000"
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="budget">Monthly Fuel Budget (ZMW)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="budget"
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="e.g. 1500.00"
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Traccar Device Assignment */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">GPS Tracking (Optional)</h4>
              <FormField
                control={form.control}
                name="traccarDeviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="traccarDeviceId">Traccar Device ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="traccarDeviceId"
                        placeholder="e.g. 5 (leave empty if not assigned yet)"
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the Traccar device ID to link this vehicle for GPS tracking
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Vehicle'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
