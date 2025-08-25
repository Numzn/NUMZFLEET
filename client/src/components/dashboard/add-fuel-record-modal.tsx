import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useCreateFuelRecord } from "@/hooks/use-fuel-records"
import { useVehicles } from "@/hooks/use-vehicles"
import { useToast } from "@/hooks/use-toast"

interface AddFuelRecordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddFuelRecordModal({ open, onOpenChange }: AddFuelRecordModalProps) {
  const [vehicleId, setVehicleId] = useState("")
  const [fuelAmount, setFuelAmount] = useState("")
  const [fuelCost, setFuelCost] = useState("")
  const [currentMileage, setCurrentMileage] = useState("")
  const [attendant, setAttendant] = useState("")
  const [pumpNumber, setPumpNumber] = useState("")
  
  const { data: vehicles = [] } = useVehicles()
  const { createFuelRecord } = useCreateFuelRecord()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!vehicleId || !fuelAmount || !fuelCost) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    try {
      await createFuelRecord({
        vehicleId,
        sessionDate: new Date().toISOString(),
        fuelAmount: Number(fuelAmount),
        fuelCost: Number(fuelCost),
        currentMileage: currentMileage ? Number(currentMileage) : undefined,
        fuelEfficiency: currentMileage && fuelAmount ? Number(currentMileage) / Number(fuelAmount) : undefined,
        attendant,
        pumpNumber
      })

      toast({
        title: "Success",
        description: "Fuel record has been added successfully."
      })
      
      // Reset form
      setVehicleId("")
      setFuelAmount("")
      setFuelCost("")
      setCurrentMileage("")
      setAttendant("")
      setPumpNumber("")
      
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add fuel record. Please try again.",
        variant: "destructive"
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Fuel Record</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Select Vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fuelAmount">Fuel Amount (L)</Label>
              <Input
                id="fuelAmount"
                type="number"
                value={fuelAmount}
                onChange={(e) => setFuelAmount(e.target.value)}
                step="0.01"
              />
            </div>
            <div className="space-y-2">              <Label htmlFor="fuelCost">Fuel Cost (ZMW)</Label>
              <Input
                id="fuelCost"
                type="number"
                value={fuelCost}
                onChange={(e) => setFuelCost(e.target.value)}
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mileage">Current Mileage (km)</Label>
            <Input
              id="mileage"
              type="number"
              value={currentMileage}
              onChange={(e) => setCurrentMileage(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="attendant">Attendant</Label>
              <Input
                id="attendant"
                value={attendant}
                onChange={(e) => setAttendant(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pump">Pump Number</Label>
              <Input
                id="pump"
                value={pumpNumber}
                onChange={(e) => setPumpNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Add Record
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}