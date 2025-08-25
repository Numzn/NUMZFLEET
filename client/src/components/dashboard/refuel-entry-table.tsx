import { useState, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useVehicles } from "@/hooks/use-vehicles"
import { useCreateFuelRecord } from "@/hooks/use-fuel-records"
import { useToast } from "@/hooks/use-toast"
import { Vehicle } from "@shared/schema"
import { cn } from "@/lib/utils"

interface RefuelEntryTableProps {
  selectedVehicleIds: string[]
}

interface EditableRow {
  vehicleId: string;
  amount: string; // Amount (ZMW)
  attendant: string;
  pumpNumber: string;
}

export function RefuelEntryTable({ selectedVehicleIds }: RefuelEntryTableProps) {
  const { data: vehicles = [] } = useVehicles();
  const { createFuelRecord } = useCreateFuelRecord();
  const { toast } = useToast();

  const [editableRows, setEditableRows] = useState<Record<string, EditableRow>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize rows for selected vehicles
  useEffect(() => {
    const newRows = selectedVehicleIds.reduce((acc, vehicleId) => {
      if (!acc[vehicleId]) {
        acc[vehicleId] = {
          vehicleId,
          amount: "",
          attendant: "",
          pumpNumber: ""
        };
      }
      return acc;
    }, { ...editableRows });
    setEditableRows(newRows);
  }, [selectedVehicleIds]);

  const selectedVehicles = vehicles.filter(v => selectedVehicleIds.includes(v.id));

  const handleFieldChange = useCallback((vehicleId: string, field: keyof EditableRow, value: string) => {
    setEditableRows(prev => ({
      ...prev,
      [vehicleId]: {
        ...prev[vehicleId],
        [field]: value
      }
    }));
  }, []);

  // Submit all rows at once
  const handleSubmitAll = async () => {
    setIsSubmitting(true);
    try {
      const toSubmit = selectedVehicles.map(vehicle => editableRows[vehicle.id]).filter(row => row && row.amount);
      for (const row of toSubmit) {
        await createFuelRecord({
          vehicleId: row.vehicleId,
          sessionDate: new Date().toISOString(),
          fuelAmount: 0,
          fuelCost: Number(row.amount),
          attendant: row.attendant || undefined,
          pumpNumber: row.pumpNumber || undefined
        });
      }
      setEditableRows({});
      // Clear selected vehicles from localStorage
      localStorage.setItem('selectedVehicles', JSON.stringify([]));
      toast({
        title: "Submitted",
        description: "All refuel records have been saved."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save some records. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedVehicleIds.length) {
    return null;
  }
  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border rounded-md">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left">Vehicle</th>
              <th className="px-2 py-2 text-left">Budget</th>
              <th className="px-2 py-2 text-left">Amount (ZMW)</th>
              <th className="px-2 py-2 text-left">Attendant</th>
              <th className="px-2 py-2 text-left">Pump #</th>
            </tr>
          </thead>
          <tbody>
            {selectedVehicles.map((vehicle) => {
              const row = editableRows[vehicle.id] || {
                vehicleId: vehicle.id,
                amount: "",
                attendant: "",
                pumpNumber: ""
              };
              return (
                <tr key={vehicle.id} className={cn(
                  vehicle.fuelType?.toLowerCase() === 'diesel' ? 'bg-purple-50 dark:bg-purple-900/10' :
                  vehicle.fuelType?.toLowerCase() === 'petrol' ? 'bg-green-50 dark:bg-green-900/10' :
                  'bg-card')}
                >
                  <td className="px-2 py-2 font-semibold">
                    {vehicle.name}
                    <div className="text-xs text-muted-foreground font-normal">
                      {vehicle.type} • {vehicle.fuelType || 'N/A'} • {vehicle.fuelCapacity ? `${vehicle.fuelCapacity}L` : 'N/A'}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    {vehicle.budget ? new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', minimumFractionDigits: 2 }).format(vehicle.budget) : "N/A"}
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="text"
                      value={row.amount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d.]/g, '');
                        handleFieldChange(vehicle.id, "amount", raw);
                      }}
                      className="w-24"
                      placeholder="K 0,000.00"
                      inputMode="decimal"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={row.attendant}
                      onChange={(e) => handleFieldChange(vehicle.id, "attendant", e.target.value)}
                      className="w-24"
                      placeholder="Name"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={row.pumpNumber}
                      onChange={(e) => handleFieldChange(vehicle.id, "pumpNumber", e.target.value)}
                      className="w-16"
                      placeholder="#"
                    />
                  </td>
                </tr>
              );
            })}
            {selectedVehicles.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground py-8">
                  No vehicles selected. Select vehicles from the vehicle management page to add fuel records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={handleSubmitAll} disabled={isSubmitting || selectedVehicles.length === 0}>
          {isSubmitting ? "Submitting..." : "Submit All"}
        </Button>
      </div>
    </div>
  );
}
