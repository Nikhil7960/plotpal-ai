import React from "react";
import type { RiskItem } from "@/services/buildPlan/types";

/**
 * 5-axis radar of risk levels (1-5). Axes in fixed order.
 */
export default function RiskRadar({ risks }: { risks: RiskItem[] }) {
  const axes: RiskItem["axis"][] = [
    "regulatory", "market", "execution", "financial", "environmental",
  ];
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 24;

  const risksByAxis: Record<RiskItem["axis"], RiskItem | undefined> = {
    regulatory: undefined, market: undefined, execution: undefined,
    financial: undefined, environmental: undefined,
  };
  for (const r of risks) risksByAxis[r.axis] = r;

  const points = axes.map((axis, i) => {
    const level = risksByAxis[axis]?.level ?? 1;
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const r = maxR * (level / 5);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  const axisLabels = axes.map((axis, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return {
      x: cx + (maxR + 14) * Math.cos(angle),
      y: cy + (maxR + 14) * Math.sin(angle),
      label: axis[0].toUpperCase() + axis.slice(1),
    };
  });

  const pathD = points.map((p, i) =>
    `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  ).join(" ") + " Z";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[260px] mx-auto">
      {/* concentric rings */}
      {[1, 2, 3, 4, 5].map(lvl => (
        <circle key={lvl} cx={cx} cy={cy} r={maxR * (lvl / 5)}
                className="fill-none stroke-muted" strokeWidth={0.5} />
      ))}
      {/* axis spokes */}
      {axes.map((_, i) => {
        const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + maxR * Math.cos(angle)}
            y2={cy + maxR * Math.sin(angle)}
            className="stroke-muted" strokeWidth={0.5}
          />
        );
      })}
      {/* filled risk shape */}
      <path d={pathD} className="fill-red-500/25 stroke-red-500" strokeWidth={1.5} />
      {/* points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} className="fill-red-600" />
      ))}
      {/* axis labels */}
      {axisLabels.map((l, i) => (
        <text key={i} x={l.x} y={l.y}
              textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 10 }}
              className="fill-foreground">
          {l.label}
        </text>
      ))}
    </svg>
  );
}
