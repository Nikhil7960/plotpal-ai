import React from "react";
import type { EnvelopeResult, PlotContext } from "@/services/buildPlan/types";

/**
 * SVG showing plot → buildable footprint (after setbacks) → stacked floors.
 * Fully generated from numbers — no external asset needed.
 */
export default function EnvelopeDiagram({
  plot, envelope,
}: { plot: PlotContext; envelope: EnvelopeResult }) {
  // Treat plot as a square for illustrative purposes unless we later wire the
  // real polygon. Side = √areaSqM; render to 220×220 SVG.
  const padding = 10;
  const box = 220;
  const inner = box - padding * 2;
  const footprintFrac = envelope.footprintEfficiency;   // 0..1
  const footprintSide = inner * Math.sqrt(footprintFrac);
  const offset = (inner - footprintSide) / 2;

  const floors = Math.min(20, Math.max(1, envelope.approxFloors));
  const stackTop = 10;
  const stackLeft = box + 40;
  const stackW = 80;
  const floorH = Math.min(12, Math.max(4, 180 / floors));
  const stackH = floors * floorH;

  return (
    <svg
      viewBox={`0 0 ${stackLeft + stackW + 16} ${Math.max(box, stackTop + stackH + 50)}`}
      className="w-full h-auto"
      role="img"
      aria-label="Buildable envelope diagram"
    >
      {/* Plot outline */}
      <rect x={padding} y={padding} width={inner} height={inner}
            fill="currentColor" className="text-muted/30"
            stroke="currentColor" strokeDasharray="4 3"
            strokeWidth={1} />
      <text x={padding} y={box - 2}
            className="fill-muted-foreground text-[10px]"
            style={{ fontSize: 10 }}>
        Plot · {Math.round(plot.areaSqM).toLocaleString()} m²
      </text>

      {/* Footprint after setbacks */}
      <rect
        x={padding + offset}
        y={padding + offset}
        width={footprintSide}
        height={footprintSide}
        className="fill-primary/20 stroke-primary"
        strokeWidth={1.5}
      />
      <text
        x={padding + offset}
        y={padding + offset - 3}
        style={{ fontSize: 10 }}
        className="fill-primary"
      >
        Footprint · {Math.round(envelope.footprintEfficiency * 100)}%
      </text>

      {/* Stacked floors */}
      {Array.from({ length: floors }).map((_, i) => (
        <rect
          key={i}
          x={stackLeft}
          y={stackTop + (floors - 1 - i) * floorH}
          width={stackW}
          height={floorH - 1}
          className={i === floors - 1 ? "fill-primary" : "fill-primary/60"}
          rx={1}
        />
      ))}
      <text x={stackLeft} y={stackTop + stackH + 14}
            style={{ fontSize: 10 }} className="fill-foreground">
        {envelope.approxFloors} floors · ~{envelope.heightEstimateM}m
      </text>
      <text x={stackLeft} y={stackTop + stackH + 28}
            style={{ fontSize: 10 }} className="fill-muted-foreground">
        FSI {envelope.recommendedFSI.toFixed(2)} / {envelope.maxPermissibleFSI.toFixed(2)}
      </text>
      <text x={stackLeft} y={stackTop + stackH + 42}
            style={{ fontSize: 10 }} className="fill-muted-foreground">
        BUA {envelope.buildableAreaSqM.toLocaleString()} m²
      </text>
    </svg>
  );
}
