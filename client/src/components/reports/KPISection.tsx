import React from "react";
import { KPICard, KPICardData, KPICardDataWithIconName } from "./KPICard";

interface KPISectionProps {
  kpis: (KPICardData | KPICardDataWithIconName)[];
  className?: string;
}

export function KPISection({ kpis, className }: KPISectionProps) {
  if (!kpis || kpis.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No KPI data available for the selected date range</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={index} data={kpi} />
        ))}
      </div>
    </div>
  );
}
