import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Fuel, DollarSign, Car, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KPICardData {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  description: string;
}

// Extended interface for when we use iconName instead of icon
export interface KPICardDataWithIconName extends Omit<KPICardData, 'icon'> {
  iconName: 'fuel' | 'cost' | 'distance' | 'efficiency';
}

interface KPICardProps {
  data: KPICardData | KPICardDataWithIconName;
  className?: string;
}

export function KPICard({ data, className }: KPICardProps) {
  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // Handle both icon and iconName props
  const renderIcon = () => {
    if ('icon' in data && data.icon) {
      return data.icon;
    }
    
    if ('iconName' in data) {
      const iconMap = {
        fuel: <Fuel className="h-4 w-4 text-muted-foreground" />,
        cost: <DollarSign className="h-4 w-4 text-muted-foreground" />,
        distance: <Car className="h-4 w-4 text-muted-foreground" />,
        efficiency: <Activity className="h-4 w-4 text-muted-foreground" />
      };
      return iconMap[data.iconName];
    }
    
    return null;
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{data.title}</CardTitle>
        {renderIcon()}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{data.value}</div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className={cn("text-xs", getTrendColor(data.trend))}>
            {getTrendIcon(data.trend)}
            <span className="ml-1">{data.change}</span>
          </Badge>
          <p className="text-xs text-muted-foreground">{data.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
