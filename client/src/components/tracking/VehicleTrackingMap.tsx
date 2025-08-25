import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Maximize2, MapPin, Wifi, WifiOff } from "lucide-react"
import { TraccarIframe } from "./TraccarIframe"
import { generateTraccarUrl } from "@/lib/traccar-auth"
import type { Vehicle } from "@shared/schema"

interface VehicleTrackingMapProps {
  vehicle: Vehicle
  className?: string
}

export function VehicleTrackingMap({ vehicle, className = "" }: VehicleTrackingMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(false)

  const hasTraccarDevice = !!vehicle.traccarDeviceId
  const isOnline = vehicle.isOnline

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const openInNewTab = () => {
    if (hasTraccarDevice) {
      const traccarUrl = generateTraccarUrl({
        deviceId: vehicle.traccarDeviceId,
        fullscreen: true,
        hideHeader: true,
        hideMenu: true,
        autoLogin: true
      });
      window.open(traccarUrl, '_blank')
    }
  }

  if (!hasTraccarDevice) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            GPS Tracking - {vehicle.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No GPS Device Assigned</h3>
            <p className="text-muted-foreground mb-4">
              This vehicle doesn't have a Traccar GPS device linked to it yet.
            </p>
            <Button asChild>
              <a href="/traccar-admin">Link GPS Device</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`${className} ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">{vehicle.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={isOnline ? "default" : "secondary"} className="text-xs">
                  {isOnline ? (
                    <>
                      <Wifi className="h-3 w-3 mr-1" />
                      Online
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 mr-1" />
                      Offline
                    </>
                  )}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Device ID: {vehicle.traccarDeviceId}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowControls(!showControls)}
            >
              Settings
            </Button>
            
            {showControls && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFullscreen}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInNewTab}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="relative">
          <TraccarIframe
            height={isFullscreen ? "calc(100vh - 120px)" : "500px"}
            showControls={false}
            autoRefresh={true}
            deviceId={vehicle.traccarDeviceId}
            className="w-full border-0"
          />
          
          {/* Status Overlay */}
          <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-2 border">
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-medium">
                {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {vehicle.lastUpdate && (
              <div className="text-xs text-muted-foreground mt-1">
                Last: {new Date(vehicle.lastUpdate).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
