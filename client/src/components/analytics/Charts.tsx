import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type ChartProps = {
  title: string;
  data: any[];
  xKey: string;
  yKey: string;
  color?: string;
}

export function BarChartCard({ title, data, xKey, yKey, color = "var(--primary)" }: ChartProps) {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis
                dataKey={xKey}
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <Bar
                dataKey={yKey}
                fill={color}
                radius={[4, 4, 0, 0]}
              />
              <Tooltip />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function GaugeChart({ value, title }: { value: number; title: string }) {
  const rotation = (value / 100) * 180; // Convert percentage to degrees (half circle)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative w-32 h-16 overflow-hidden">
          {/* Background semi-circle */}
          <div className="absolute w-full h-32 rounded-full bg-muted" 
               style={{ clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)' }} />
          
          {/* Colored gauge indicator */}
          <div className="absolute w-full h-32 rounded-full bg-primary origin-bottom transition-transform duration-500" 
               style={{ 
                 clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)',
                 transform: `rotate(${rotation}deg)`
               }} />
               
          {/* Center point */}
          <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-primary rounded-full transform -translate-x-1/2" />
        </div>
        <div className="mt-4 text-2xl font-bold">{value}%</div>
        <p className="text-xs text-muted-foreground">Based on fuel usage patterns</p>
      </CardContent>
    </Card>
  );
}

export function DonutChart({ data, title }: { data: { name: string; value: number; color: string }[]; title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative w-32 h-32">
          <div className="w-32 h-32 rounded-full bg-gradient-to-r from-green-400 via-blue-400 to-red-400 flex items-center justify-center">
            <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center">
              <span className="text-lg font-bold">{data.reduce((sum, item) => sum + item.value, 0)}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-1">
          {data.map((item) => (
            <div key={item.name} className="flex items-center space-x-2 text-sm">
              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: item.color }} />
              <span>{item.name}: {item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function LineChart({ data, title, xKey, yKey }: { data: any[]; title: string; xKey: string; yKey: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis
                dataKey={xKey}
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <Bar
                dataKey={yKey}
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
              />
              <Tooltip />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
