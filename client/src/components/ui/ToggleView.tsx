import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChartBar, ClipboardList } from "lucide-react";

type ToggleViewProps = {
  view: "refueling" | "analytics";
  onChange: (view: "refueling" | "analytics") => void;
};

export function ToggleView({ view, onChange }: ToggleViewProps) {
  return (
    <div className="flex items-center space-x-2 bg-muted p-1 rounded-lg">
      <Button
        variant={view === "refueling" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("refueling")}
        className="flex items-center space-x-2"
      >
        <ClipboardList className="h-4 w-4" />
        <span>Refueling Dashboard</span>
      </Button>
      <Button
        variant={view === "analytics" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("analytics")}
        className="flex items-center space-x-2"
      >
        <ChartBar className="h-4 w-4" />
        <span>Fleet Analytics</span>
      </Button>
    </div>
  );
}
