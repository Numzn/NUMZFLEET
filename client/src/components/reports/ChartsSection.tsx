import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { BarChart3, PieChart, Activity, TrendingUp } from "lucide-react";

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
  }>;
}

interface ChartsSectionProps {
  chartData: {
    fuel: ChartData;
    cost: ChartData;
    distance: ChartData;
  } | null;
  className?: string;
}

export function ChartsSection({ chartData, className }: ChartsSectionProps) {
  if (!chartData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No chart data available for the selected date range</p>
      </div>
    );
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Performance Metrics Over Time',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className={className}>
      <Tabs defaultValue="fuel" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fuel" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Fuel
          </TabsTrigger>
          <TabsTrigger value="cost" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Cost
          </TabsTrigger>
          <TabsTrigger value="distance" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Distance
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fuel" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Fuel Consumption Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Line data={chartData.fuel} options={chartOptions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Cost Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Bar data={chartData.cost} options={chartOptions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Distance Covered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Line data={chartData.distance} options={chartOptions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Fuel Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Pie 
                  data={{
                    labels: chartData.fuel.labels.slice(0, 5), // Show top 5 days
                    datasets: [{
                      data: chartData.fuel.datasets[0].data.slice(0, 5),
                      backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(168, 85, 247, 0.8)',
                        'rgba(251, 146, 60, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                      ],
                    }]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                      },
                    },
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Cost Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Doughnut 
                  data={{
                    labels: chartData.cost.labels.slice(0, 5), // Show top 5 days
                    datasets: [{
                      data: chartData.cost.datasets[0].data.slice(0, 5),
                      backgroundColor: [
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(168, 85, 247, 0.8)',
                        'rgba(251, 146, 60, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                      ],
                    }]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                      },
                    },
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


