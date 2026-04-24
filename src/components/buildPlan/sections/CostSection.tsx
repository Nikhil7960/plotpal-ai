import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Info } from "lucide-react";
import type { BuildPlan, CostLine } from "@/services/buildPlan/types";
import {
  formatRangeINR, formatINR,
} from "@/services/buildPlan/costCatalog";
import RangeBar from "../visuals/RangeBar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function CostSection({ plan }: { plan: BuildPlan }) {
  const { cost } = plan;
  const allLines: CostLine[] = [
    ...cost.hard, ...cost.soft, ...cost.approvals, ...cost.financing, cost.contingency,
  ];
  const globalMax = Math.max(...allLines.map(l => l.range.high));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          What will it cost?
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <div>
            <div className="text-xs text-muted-foreground">All-in (mid)</div>
            <div className="text-xl font-semibold">{formatINR(cost.total.mid)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Range</div>
            <div className="text-sm font-medium">{formatRangeINR(cost.total)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Per sqft</div>
            <div className="text-sm font-medium">
              ₹{cost.perSqFt.low.toFixed(0)}–{cost.perSqFt.high.toFixed(0)}
            </div>
          </div>
          {plan.preferences.budgetCapINR && (
            <Badge variant={
              cost.total.mid > plan.preferences.budgetCapINR ? "destructive" : "secondary"
            }>
              {cost.total.mid > plan.preferences.budgetCapINR
                ? `Over budget by ${formatINR(cost.total.mid - plan.preferences.budgetCapINR)}`
                : `Within budget`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Group title="Hard cost · structure + finishes + MEP" lines={cost.hard} globalMax={globalMax} />
        <Group title="Soft cost · design, PMC, legal" lines={cost.soft} globalMax={globalMax} />
        <Group title="Approvals & premiums" lines={cost.approvals} globalMax={globalMax} />
        <Group title="Financing" lines={cost.financing} globalMax={globalMax} />
        <Group title="Contingency" lines={[cost.contingency]} globalMax={globalMax} />
      </CardContent>
    </Card>
  );
}

function Group({
  title, lines, globalMax,
}: { title: string; lines: CostLine[]; globalMax: number }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </p>
      <div className="space-y-2.5">
        {lines.map(l => (
          <div key={l.key} className="grid grid-cols-[1fr_auto] gap-3 items-start">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{l.label}</span>
                {l.assumption && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground shrink-0 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      {l.assumption}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {l.note && (
                <p className="text-xs text-muted-foreground">{l.note}</p>
              )}
              <div className="mt-1.5">
                <RangeBar
                  range={l.range}
                  globalMax={globalMax}
                  format={formatINR}
                />
              </div>
            </div>
            <div className="text-right tabular-nums text-sm font-medium whitespace-nowrap">
              {formatINR(l.range.mid)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
