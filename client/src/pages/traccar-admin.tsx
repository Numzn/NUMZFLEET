import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { RefreshCw, Link, MapPin } from "lucide-react";
import { useTraccarAdmin } from "@/hooks/use-traccar-admin";
import { DeviceLinkingForm } from "@/components/tracking/DeviceLinkingForm";
import { DeviceStatusCard } from "@/components/tracking/DeviceStatusCard";

export default function TraccarAdmin() {
  // TODO: Replace with Supabase hooks
  const { data: vehicles = [] } = { data: [] };
  const { mutate: updateVehicle } = { 
    mutate: (data: any) => console.log('🔧 Supabase integration needed for vehicle update', data)
  };

  const {
    assignedDevices,
    unassignedDevices,
    unassignedVehicles,
    isLoading,
    isLinking,
    selectedDeviceId,
    setSelectedDeviceId,
    selectedVehicleId,
    setSelectedVehicleId,
    fetchDevices,
    linkDeviceToVehicle,
    unlinkDevice
  } = useTraccarAdmin(vehicles, updateVehicle);

  return (
    <div className="min-h-screen bg-background">

      
      {/* Main Content */}
      <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Traccar Administration</h1>
              <p className="text-muted-foreground mt-2">
                Manage GPS tracking devices and link them to your fleet vehicles
              </p>
            </div>
            
            <Button onClick={fetchDevices} disabled={isLoading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh Devices'}
            </Button>
          </div>
        </div>

        {/* Device Linking Form */}
        <DeviceLinkingForm
          selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={setSelectedDeviceId}
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={setSelectedVehicleId}
          unassignedDevices={unassignedDevices}
          unassignedVehicles={unassignedVehicles}
          onLinkDevice={linkDeviceToVehicle}
          isLinking={isLinking}
        />

        {/* Devices Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assigned Devices */}
          <DeviceStatusCard
            title="Assigned Devices"
            devices={assignedDevices}
            showUnlinkButton={true}
            onUnlinkDevice={unlinkDevice}
            emptyMessage="No devices are currently assigned to vehicles"
            icon={<Link className="h-5 w-5" />}
          />

          {/* Unassigned Devices */}
          <DeviceStatusCard
            title="Available Devices"
            devices={unassignedDevices}
            showUnlinkButton={false}
            emptyMessage="All devices are currently assigned"
            icon={<MapPin className="h-5 w-5" />}
          />
        </div>
      </main>
    </div>
  );
}
