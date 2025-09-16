import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { HistoricalPosition } from '@/lib/history-api';
import { useTheme } from '@/hooks/use-theme';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FuelGraphProps {
  data: HistoricalPosition[];
  currentTime: Date | null;
  height?: number;
  className?: string;
}

interface FuelDataPoint {
  timestamp: string;
  fuelLevel: number;
  time: number;
  speed: number;
  isRefuel: boolean;
  isCurrent: boolean;
}

export const FuelGraph: React.FC<FuelGraphProps> = ({ 
  data, 
  currentTime, 
  height = 200,
  className = ''
}) => {
  const { theme } = useTheme();
  // Process data for the fuel graph
  const fuelData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const positionsWithFuel = data.filter(pos => 
      pos.fuelLevel !== null && 
      pos.fuelLevel !== undefined && 
      pos.fuelLevel >= 0
    );

    if (positionsWithFuel.length === 0) return [];

    // Convert to chart data format
    const chartData: FuelDataPoint[] = positionsWithFuel.map((pos, index) => {
      const timestamp = new Date(pos.deviceTime);
      const isRefuel = index > 0 && 
        pos.fuelLevel! > positionsWithFuel[index - 1].fuelLevel! + 5; // 5% increase = refuel
      
      return {
        timestamp: timestamp.toISOString(),
        fuelLevel: pos.fuelLevel!,
        time: timestamp.getTime(),
        speed: pos.speed || 0,
        isRefuel,
        isCurrent: currentTime ? Math.abs(timestamp.getTime() - currentTime.getTime()) < 30000 : false // Within 30 seconds
      };
    });

    return chartData;
  }, [data, currentTime]);

  // Find refuel events for highlighting
  const refuelEvents = useMemo(() => {
    return fuelData.filter(point => point.isRefuel);
  }, [fuelData]);

  // Calculate fuel statistics
  const fuelStats = useMemo(() => {
    if (fuelData.length === 0) return null;

    const fuelLevels = fuelData.map(d => d.fuelLevel);
    const totalFuelUsed = fuelData.length > 1 ? 
      Math.max(0, fuelData[0].fuelLevel - fuelData[fuelData.length - 1].fuelLevel) : 0;
    
    return {
      startFuel: fuelData[0]?.fuelLevel || 0,
      endFuel: fuelData[fuelData.length - 1]?.fuelLevel || 0,
      totalUsed: totalFuelUsed,
      averageFuel: fuelLevels.reduce((sum, level) => sum + level, 0) / fuelLevels.length,
      refuelCount: refuelEvents.length,
      minFuel: Math.min(...fuelLevels),
      maxFuel: Math.max(...fuelLevels)
    };
  }, [fuelData, refuelEvents]);

  if (fuelData.length === 0) {
    return (
      <Card className={className} style={{ height }}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <div className="text-2xl mb-2">⛽</div>
            <p>No fuel data available for this time period</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <span className="mr-2">⛽</span>
            Fuel Consumption
          </CardTitle>
          {fuelStats && (
            <div className="text-sm text-muted-foreground">
              {fuelStats.refuelCount > 0 && (
                <span className="mr-4">
                  <span className="font-medium text-green-600">{fuelStats.refuelCount}</span> refuels
                </span>
              )}
              <span>
                <span className="font-medium text-foreground">{fuelStats.totalUsed.toFixed(1)}%</span> used
              </span>
            </div>
          )}
        </div>
        
        {/* Fuel level indicator */}
        {fuelStats && (
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-muted-foreground">Start: <span className="text-foreground">{fuelStats.startFuel.toFixed(1)}%</span></span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span className="text-muted-foreground">End: <span className="text-foreground">{fuelStats.endFuel.toFixed(1)}%</span></span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-muted-foreground">Avg: <span className="text-foreground">{fuelStats.averageFuel.toFixed(1)}%</span></span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>

      {/* Chart */}
      <div style={{ height: height - 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={fuelData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <XAxis 
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
              }}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as FuelDataPoint;
                  const time = new Date(data.time);
                  return (
                    <div className="bg-popover p-3 border rounded-lg shadow-lg">
                      <p className="font-medium text-popover-foreground">
                        {time.toLocaleString()}
                      </p>
                      <p className="text-primary">
                        Fuel: <span className="font-medium">{data.fuelLevel.toFixed(1)}%</span>
                      </p>
                      <p className="text-muted-foreground">
                        Speed: <span className="font-medium">{data.speed.toFixed(0)} km/h</span>
                      </p>
                      {data.isRefuel && (
                        <p className="text-green-600 font-medium">🔄 Refuel Event</p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            
            {/* Main fuel level line */}
            <Line
              type="monotone"
              dataKey="fuelLevel"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#3B82F6' }}
            />
            
            {/* Refuel events as special dots */}
            {refuelEvents.map((event, index) => (
              <Line
                key={`refuel-${index}`}
                type="monotone"
                dataKey={(entry) => entry.isRefuel ? entry.fuelLevel : null}
                stroke="#10B981"
                strokeWidth={0}
                dot={{ r: 6, fill: '#10B981', stroke: '#10B981', strokeWidth: 2 }}
                connectNulls={false}
              />
            ))}
            
            {/* Current time reference line */}
            {currentTime && (
              <ReferenceLine 
                x={currentTime.getTime()} 
                stroke="#EF4444" 
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: "Now", position: "top" }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-center space-x-6 text-xs text-muted-foreground">
            <div className="flex items-center">
              <div className="w-3 h-0.5 bg-primary mr-2"></div>
              <span>Fuel Level</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>Refuel Events</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-0.5 bg-red-500 mr-2" style={{ borderStyle: 'dashed' }}></div>
              <span>Current Time</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
