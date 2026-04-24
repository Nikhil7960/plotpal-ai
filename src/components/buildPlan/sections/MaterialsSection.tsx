import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes } from "lucide-react";
import type { BuildPlan } from "@/services/buildPlan/types";
import { formatBoqQty } from "@/services/buildPlan/materialsCatalog";

export default function MaterialsSection({ plan }: { plan: BuildPlan }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Boxes className="h-5 w-5" />
          What goes into it?
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Napkin BoQ derived from built-up area and infra type. Swap for contractor's
          quantities during detailed design.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {plan.materials.map(m => (
            <div key={m.key}
                 className="rounded-md border bg-card p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{m.label}</div>
                {m.note && (
                  <p className="text-xs text-muted-foreground mt-0.5">{m.note}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold tabular-nums">
                  {formatBoqQty(m.quantity)}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {m.unit}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
