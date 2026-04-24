import React from "react";
import type { Range } from "@/services/buildPlan/types";
import { cn } from "@/lib/utils";

interface RangeBarProps {
  range: Range;
  globalMax: number;    // max value across the set — for relative widths
  format?: (n: number) => string;
  className?: string;
  accent?: "primary" | "warn" | "success";
}

/**
 * A horizontal "low–mid–high" bar that visualises a Range on a common scale.
 * Used in the cost waterfall list + elsewhere.
 */
export default function RangeBar({
  range, globalMax, format = n => n.toFixed(1), accent = "primary", className,
}: RangeBarProps) {
  const pctLow = Math.max(0, Math.min(100, (range.low / globalMax) * 100));
  const pctMid = Math.max(0, Math.min(100, (range.mid / globalMax) * 100));
  const pctHigh = Math.max(0, Math.min(100, (range.high / globalMax) * 100));

  const fill = accent === "warn" ? "bg-amber-500/70" :
               accent === "success" ? "bg-emerald-500/70" :
               "bg-primary/70";

  return (
    <div className={cn("w-full", className)}>
      <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
        <div
          className={cn("absolute top-0 h-full", fill)}
          style={{ left: `${pctLow}%`, width: `${Math.max(1, pctHigh - pctLow)}%` }}
        />
        <div
          className="absolute top-0 h-full w-[2px] bg-foreground/80"
          style={{ left: `${pctMid}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground mt-1 tabular-nums">
        <span>{format(range.low)}</span>
        <span className="font-medium text-foreground">{format(range.mid)}</span>
        <span>{format(range.high)}</span>
      </div>
    </div>
  );
}
