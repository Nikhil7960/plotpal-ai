import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, IndianRupee, Calendar, Gauge,
} from "lucide-react";
import type { BuildPlan } from "@/services/buildPlan/types";
import {
  formatRangeINR,
} from "@/services/buildPlan/costCatalog";
import { timelineTotalMonths } from "@/services/buildPlan/timelineGenerator";

export default function PlanHeader({ plan }: { plan: BuildPlan }) {
  const totalMonths = timelineTotalMonths(plan.timeline);
  const confidenceLabel = plan.confidence === "napkin"
    ? "Napkin math"
    : plan.confidence === "indicative" ? "Indicative" : "Detailed";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate max-w-xl">{plan.plot.address}</span>
            {plan.plot.ward && <Badge variant="outline">{plan.plot.ward}</Badge>}
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">
            Build plan · {titleize(plan.infra)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {plan.plot.areaSqM.toLocaleString()} m² plot · {plan.plot.isIslandCity ? "Island city" : "Suburb"} ·
            {" "}road {plan.plot.roadWidthM}m
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Gauge className="h-3 w-3" /> {confidenceLabel}
          </Badge>
          <Badge variant="outline" className="capitalize">{plan.scenario}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          icon={<IndianRupee className="h-4 w-4" />}
          label="All-in cost range"
          value={formatRangeINR(plan.cost.total)}
          sub={`${plan.cost.perSqFt.low.toFixed(0)}–${plan.cost.perSqFt.high.toFixed(0)} ₹/sqft`}
        />
        <KpiCard
          icon={<Calendar className="h-4 w-4" />}
          label="Months to OC"
          value={`${totalMonths} mo`}
          sub={`${plan.approvals.length} approvals gated`}
        />
        <KpiCard
          icon={<Gauge className="h-4 w-4" />}
          label="Buildable area"
          value={`${plan.envelope.buildableAreaSqM.toLocaleString()} m²`}
          sub={`${plan.envelope.approxFloors} floors · FSI ${plan.envelope.recommendedFSI.toFixed(2)}`}
        />
      </div>

      {plan.redFlags.length > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
          <p className="font-medium text-red-700 dark:text-red-400 mb-1">Red flags</p>
          <ul className="space-y-1 text-red-800 dark:text-red-300">
            {plan.redFlags.map((f, i) => <li key={i}>• {f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      <div className="text-xl font-semibold mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function titleize(s: string) { return s[0].toUpperCase() + s.slice(1); }
