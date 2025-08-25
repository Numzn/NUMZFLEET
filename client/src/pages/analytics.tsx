import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export default function Analytics() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Fleet Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive insights into your fleet performance and fuel efficiency
          </p>
        </div>
        <AnalyticsDashboard />
      </main>
    </div>
  );
}
