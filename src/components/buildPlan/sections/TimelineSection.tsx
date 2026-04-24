import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Hourglass } from "lucide-react";
import type { BuildPlan } from "@/services/buildPlan/types";
import GanttStrip from "../visuals/GanttStrip";
import {
  timelineTotalMonths,
} from "@/services/buildPlan/timelineGenerator";
import { formatINR } from "@/services/buildPlan/costCatalog";

export default function TimelineSection({ plan }: { plan: BuildPlan }) {
  const totalMonths = timelineTotalMonths(plan.timeline);
  // Interest-on-idle-land counter is illustrative: ~10% of cost.total.mid × months/12 × 0.4 weighting.
  const idleInterestLakh = (plan.cost.total.mid * 0.1 * (totalMonths / 12) * 0.4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          How long?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <GanttStrip phases={plan.timeline} totalMonths={totalMonths} />
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md p-3">
          <Hourglass className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="text-foreground font-medium">
              {formatINR(idleInterestLakh)}
            </span>{" "}
            is what delay-driven financing + idle-land interest would cost across this timeline
            — a rough estimate at ~10% blended cost of capital.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
