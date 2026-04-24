import React from "react";
import type { TimelinePhase } from "@/services/buildPlan/types";
import {
  monsoonMonthsInRange,
} from "@/services/buildPlan/timelineGenerator";
import { cn } from "@/lib/utils";

/**
 * Horizontal timeline with 5 swim-lanes + monsoon hatching.
 * t0 is considered April (start of Indian financial year).
 */
export default function GanttStrip({
  phases, totalMonths,
}: { phases: TimelinePhase[]; totalMonths: number }) {
  const SWIMLANES = ["approvals", "foundation", "structure", "mep", "finishes"] as const;
  const LANE_LABEL: Record<(typeof SWIMLANES)[number], string> = {
    approvals: "Approvals",
    foundation: "Foundation",
    structure: "Structure",
    mep: "MEP",
    finishes: "Finishes",
  };
  const width = 100; // viewBox width % — use CSS-friendly %
  const height = SWIMLANES.length * 28 + 34;
  const pxPerMonth = 100 / Math.max(totalMonths, 1);

  // Month-of-year ticks (every 3 months)
  const ticks: Array<{ atPct: number; label: string }> = [];
  for (let m = 0; m <= totalMonths; m += 3) {
    const monthOfYear = (m + 3) % 12; // t0 = April
    const yearOffset = Math.floor((m + 3) / 12);
    const labels = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
    const idx = monthOfYear;
    ticks.push({
      atPct: m * pxPerMonth,
      label: `${labels[(idx) % 12]}${yearOffset > 0 ? `·Y${yearOffset + 1}` : ""}`,
    });
  }

  // Monsoon band positions across the whole timeline.
  const monsoon = monsoonMonthsInRange(0, totalMonths);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        {/* Monsoon hatches */}
        {monsoon.map(m => (
          <div
            key={`mon-${m}`}
            className="absolute top-0 bottom-6 bg-blue-500/8 border-l border-dashed border-blue-500/30"
            style={{ left: `${m * pxPerMonth}%`, width: `${pxPerMonth}%` }}
            aria-hidden
          />
        ))}

        {/* Ticks */}
        {ticks.map((t, i) => (
          <div key={i} className="absolute top-0 bottom-6 border-l border-muted"
               style={{ left: `${t.atPct}%` }}>
            <span className="absolute -bottom-5 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
              {t.label}
            </span>
          </div>
        ))}

        {/* Swim lanes */}
        {SWIMLANES.map((lane, li) => (
          <div key={lane} className="absolute left-0 right-0"
               style={{ top: li * 28, height: 28 }}>
            <div className="absolute left-0 top-0 bottom-0 w-24 flex items-center">
              <span className="text-xs text-muted-foreground">{LANE_LABEL[lane]}</span>
            </div>
            <div className="absolute left-24 right-0 top-0 bottom-0 border-t border-muted/60" />
            {phases.filter(p => p.swimlane === lane).map(p => (
              <div
                key={p.key}
                className={cn(
                  "absolute top-1 h-6 rounded-md text-[11px] px-2 flex items-center text-white font-medium",
                  p.critical ? "bg-primary" : "bg-primary/60"
                )}
                style={{
                  left: `calc(96px + ${p.startMonth * pxPerMonth}% * (100% - 96px) / 100%)`,
                  width: `calc(${p.durationMonths * pxPerMonth}% * (100% - 96px) / 100%)`,
                }}
                title={`${p.label} · ${p.durationMonths} mo`}
              >
                <span className="truncate">{p.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary" /> critical path
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/30" /> monsoon (Jun–Sep)
        </span>
        <span>Total: {totalMonths} months</span>
      </div>
    </div>
  );
}
