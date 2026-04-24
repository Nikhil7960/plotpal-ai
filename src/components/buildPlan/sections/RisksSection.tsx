import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import type { BuildPlan, RiskItem } from "@/services/buildPlan/types";
import RiskRadar from "../visuals/RiskRadar";

const LEVEL_COLOR: Record<RiskItem["level"], string> = {
  1: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  2: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  3: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  4: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  5: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

export default function RisksSection({ plan }: { plan: BuildPlan }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Risks & unknowns
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        <div>
          <RiskRadar risks={plan.risks} />
          <p className="text-[11px] text-muted-foreground text-center mt-1">
            Levels 1 (low) – 5 (high) per axis
          </p>
        </div>
        <div className="space-y-2">
          {plan.risks.map(r => (
            <div key={r.key}
                 className={`rounded-md border p-3 text-sm ${LEVEL_COLOR[r.level]}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.title}</span>
                <Badge variant="outline">Level {r.level}</Badge>
              </div>
              <p className="mt-1 text-[13px]">{r.detail}</p>
              {r.mitigation && (
                <p className="mt-1 text-[12px] opacity-90">
                  <span className="font-medium">Mitigation:</span> {r.mitigation}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
