import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "lucide-react";

interface DeviceLinkingFormProps {
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  unassignedDevices: any[];
  unassignedVehicles: any[];
  onLinkDevice: () => void;
  isLinking?: boolean;
}

export function DeviceLinkingForm({
  selectedDeviceId,
  setSelectedDeviceId,
  selectedVehicleId,
  setSelectedVehicleId,
  unassignedDevices,
  unassignedVehicles,
  onLinkDevice,
  isLinking = false
}: DeviceLinkingFormProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Link Device to Vehicle</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="device-select">Select Device</Label>
            <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a device" />
              </SelectTrigger>
              <SelectContent>
                {unassignedDevices.map(device => (
                  <SelectItem key={device.id} value={device.id.toString()}>
                    {device.name} (ID: {device.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="vehicle-select">Select Vehicle</Label>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {unassignedVehicles.map(vehicle => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} ({vehicle.plateNumber || 'No Plate'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button 
              onClick={onLinkDevice}
              disabled={!selectedDeviceId || !selectedVehicleId || isLinking}
              className="w-full"
            >
              <Link className="mr-2 h-4 w-4" />
              {isLinking ? 'Linking...' : 'Link Device'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


