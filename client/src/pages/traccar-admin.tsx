import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
// TODO: Replace with Supabase hooks
// import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles"
import { NavigationBar } from "@/components/NavigationBar"
import { RefreshCw, Link, Unlink, MapPin, Wifi, WifiOff } from "lucide-react"
import { getTraccarCredentials } from "@/lib/traccar-auth"
import type { TraccarDevice } from "@shared/schema"

interface TraccarDeviceWithAssignment extends TraccarDevice {
  assignedVehicle?: string;
  vehicleName?: string;
}

export default function TraccarAdmin() {
  const [devices, setDevices] = useState<TraccarDeviceWithAssignment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("")
  
  // TODO: Replace with Supabase hooks
  const { data: vehicles = [] } = { data: [] };
  const { mutate: updateVehicle } = { 
    mutate: (data: any) => console.log('🔧 Supabase integration needed for vehicle update', data)
  };
  const { toast } = useToast()

  // Fetch Traccar devices
  const fetchDevices = async () => {
    setIsLoading(true)
    try {
      const credentials = getTraccarCredentials();
      const authHeader = credentials 
        ? `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
        : `Basic ${import.meta.env.VITE_TRACCAR_AUTH}`;
        
      const response = await fetch(`${import.meta.env.VITE_TRACCAR_URL}/api/devices`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Map devices and check if they're assigned to vehicles
      const devicesWithAssignments = data.map((device: TraccarDevice) => {
        const assignedVehicle = vehicles.find(v => v.traccarDeviceId === device.id.toString())
        return {
          ...device,
          assignedVehicle: assignedVehicle?.id,
          vehicleName: assignedVehicle?.name
        }
      })

      setDevices(devicesWithAssignments)
      toast({
        title: "Success",
        description: `Fetched ${devicesWithAssignments.length} devices from Traccar`
      })
    } catch (error) {
      console.error('Failed to fetch devices:', error)
      toast({
        title: "Error",
        description: "Failed to fetch devices from Traccar. Check your connection and credentials.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Link device to vehicle
  const linkDeviceToVehicle = async () => {
    if (!selectedDeviceId || !selectedVehicleId) {
      toast({
        title: "Error",
        description: "Please select both a device and a vehicle",
        variant: "destructive"
      })
      return
    }

    try {
      const vehicle = vehicles.find(v => v.id === selectedVehicleId)
      if (!vehicle) {
        throw new Error("Vehicle not found")
      }

      // Update vehicle with Traccar device ID
      await updateVehicle({
        id: selectedVehicleId,
        updates: {
          traccarDeviceId: selectedDeviceId
        }
      })

      // Update Traccar device name to match vehicle
      const credentials = getTraccarCredentials();
      const authHeader = credentials 
        ? `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
        : `Basic ${import.meta.env.VITE_TRACCAR_AUTH}`;
        
      await fetch(`${import.meta.env.VITE_TRACCAR_URL}/api/devices/${selectedDeviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: vehicle.name
        })
      })

      toast({
        title: "Success",
        description: `Device ${selectedDeviceId} linked to ${vehicle.name}`
      })

      // Refresh devices list
      fetchDevices()
      
      // Reset selection
      setSelectedDeviceId("")
      setSelectedVehicleId("")
    } catch (error) {
      console.error('Failed to link device:', error)
      toast({
        title: "Error",
        description: "Failed to link device to vehicle",
        variant: "destructive"
      })
    }
  }

  // Unlink device from vehicle
  const unlinkDevice = async (deviceId: string) => {
    try {
      const vehicle = vehicles.find(v => v.traccarDeviceId === deviceId)
      if (!vehicle) return

      await updateVehicle({
        id: vehicle.id,
        updates: {
          traccarDeviceId: ""
        }
      })

      toast({
        title: "Success",
        description: `Device ${deviceId} unlinked from ${vehicle.name}`
      })

      fetchDevices()
    } catch (error) {
      console.error('Failed to unlink device:', error)
      toast({
        title: "Error",
        description: "Failed to unlink device",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const unassignedVehicles = vehicles.filter(v => !v.traccarDeviceId)
  const unassignedDevices = devices.filter(d => !d.assignedVehicle)

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Traccar Device Management</h1>
            <p className="text-muted-foreground mt-2">
              Link GPS devices to vehicles for real-time tracking
            </p>
          </div>
          <Button onClick={fetchDevices} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Devices
          </Button>
        </div>

        {/* Device Linking Section */}
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
                  onClick={linkDeviceToVehicle}
                  disabled={!selectedDeviceId || !selectedVehicleId}
                  className="w-full"
                >
                  <Link className="mr-2 h-4 w-4" />
                  Link Device
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Devices Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assigned Devices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Assigned Devices ({devices.filter(d => d.assignedVehicle).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {devices.filter(d => d.assignedVehicle).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No devices are currently assigned to vehicles
                </p>
              ) : (
                <div className="space-y-3">
                  {devices.filter(d => d.assignedVehicle).map(device => (
                    <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {device.status === 'online' ? (
                            <Wifi className="h-4 w-4 text-green-500" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-red-500" />
                          )}
                          <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                            {device.status}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-medium">{device.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ID: {device.id} • {device.vehicleName}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unlinkDevice(device.id.toString())}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unassigned Devices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Available Devices ({unassignedDevices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unassignedDevices.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  All devices are currently assigned
                </p>
              ) : (
                <div className="space-y-3">
                  {unassignedDevices.map(device => (
                    <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {device.status === 'online' ? (
                            <Wifi className="h-4 w-4 text-green-500" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-red-500" />
                          )}
                          <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                            {device.status}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-medium">{device.name}</p>
                          <p className="text-sm text-muted-foreground">ID: {device.id}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
