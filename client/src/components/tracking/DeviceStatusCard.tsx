import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Link, MapPin, Unlink } from "lucide-react";

interface DeviceStatusCardProps {
  title: string;
  devices: any[];
  showUnlinkButton?: boolean;
  onUnlinkDevice?: (deviceId: string) => void;
  emptyMessage: string;
  icon: React.ReactNode;
}

export function DeviceStatusCard({
  title,
  devices,
  showUnlinkButton = false,
  onUnlinkDevice,
  emptyMessage,
  icon
}: DeviceStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title} ({devices.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-3">
            {devices.map(device => (
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
                      ID: {device.id}
                      {device.vehicleName && ` • ${device.vehicleName}`}
                    </p>
                  </div>
                </div>
                {showUnlinkButton && onUnlinkDevice && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUnlinkDevice(device.id.toString())}
                  >
                    <Unlink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


