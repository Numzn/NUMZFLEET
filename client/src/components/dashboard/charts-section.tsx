import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts"
import { BarChart3, TrendingUp } from "lucide-react"
import type { Vehicle } from "@shared/schema"
import { useState } from "react"

interface ChartsSectionProps {
  vehicles: Vehicle[]
}

export function ChartsSection({ vehicles }: ChartsSectionProps) {
  const [budgetChartType, setBudgetChartType] = useState("bar")
  const [trendsTimeframe, setTrendsTimeframe] = useState("7days")

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Prepare budget vs actual data
  const budgetData = vehicles.map(vehicle => ({
    name: vehicle.name,
    budget: vehicle.budget,
    actual: vehicle.actual || 0,
    variance: vehicle.budget - (vehicle.actual || 0),
  }))

  // Prepare efficiency trends data (mock data for demonstration)
  const getTrendsData = (timeframe: string) => {
    switch (timeframe) {
      case "7days":
        return [
          { period: "Mon", efficiency: 95, cost: 1200 },
          { period: "Tue", efficiency: 87, cost: 1350 },
          { period: "Wed", efficiency: 92, cost: 1100 },
          { period: "Thu", efficiency: 88, cost: 1500 },
          { period: "Fri", efficiency: 96, cost: 1400 },
          { period: "Sat", efficiency: 91, cost: 1250 },
          { period: "Sun", efficiency: 94, cost: 1600 },
        ]
      case "30days":
        return [
          { period: "Week 1", efficiency: 91, cost: 8500 },
          { period: "Week 2", efficiency: 93, cost: 8200 },
          { period: "Week 3", efficiency: 89, cost: 8800 },
          { period: "Week 4", efficiency: 95, cost: 8100 },
        ]
      case "90days":
        return [
          { period: "Month 1", efficiency: 92, cost: 34000 },
          { period: "Month 2", efficiency: 94, cost: 32500 },
          { period: "Month 3", efficiency: 91, cost: 35200 },
        ]
      default:
        return []
    }
  }

  const trendsData = getTrendsData(trendsTimeframe)

  // Prepare pie chart data for budget distribution
  const pieData = vehicles.map((vehicle, index) => ({
    name: vehicle.name,
    value: vehicle.budget,
    fill: `hsl(${(index * 360) / vehicles.length}, 70%, 50%)`,
  }))

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Budget vs Actual Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-lg">
              <BarChart3 className="h-5 w-5 text-primary mr-2" />
              Budget vs Actual
            </CardTitle>
            <Select value={budgetChartType} onValueChange={setBudgetChartType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {budgetChartType === "bar" && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-muted-foreground" 
                    fontSize={12}
                  />
                  <YAxis 
                    className="text-muted-foreground"
                    fontSize={12}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip 
                    formatter={(value, name) => [formatCurrency(Number(value)), name]}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="budget" 
                    name="Budget"
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="actual" 
                    name="Actual"
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {budgetChartType === "line" && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={budgetData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-muted-foreground"
                    fontSize={12}
                  />
                  <YAxis 
                    className="text-muted-foreground"
                    fontSize={12}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip 
                    formatter={(value, name) => [formatCurrency(Number(value)), name]}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="budget" 
                    name="Budget"
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    name="Actual"
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {budgetChartType === "pie" && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [formatCurrency(Number(value)), "Budget"]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Efficiency Trends Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-lg">
              <TrendingUp className="h-5 w-5 text-emerald-600 mr-2" />
              Efficiency Trends
            </CardTitle>
            <Select value={trendsTimeframe} onValueChange={setTrendsTimeframe}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="period" 
                  className="text-muted-foreground"
                  fontSize={12}
                />
                <YAxis 
                  yAxisId="efficiency"
                  orientation="left"
                  className="text-muted-foreground"
                  fontSize={12}
                  domain={[80, 100]}
                />
                <YAxis 
                  yAxisId="cost"
                  orientation="right"
                  className="text-muted-foreground"
                  fontSize={12}
                  tickFormatter={formatCurrency}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    name === "efficiency" ? `${value}%` : formatCurrency(Number(value)),
                    name === "efficiency" ? "Efficiency" : "Daily Cost"
                  ]}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  yAxisId="efficiency"
                  type="monotone" 
                  dataKey="efficiency" 
                  name="efficiency"
                  stroke="#f59e0b" 
                  strokeWidth={3}
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  yAxisId="cost"
                  type="monotone" 
                  dataKey="cost" 
                  name="cost"
                  stroke="#10b981" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
