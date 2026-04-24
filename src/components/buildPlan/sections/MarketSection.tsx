import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, MapPinned } from "lucide-react";
import type { BuildPlan } from "@/services/buildPlan/types";
import type { POICategory } from "@/utils/osmPOI";

interface MarketSectionProps {
  plan: BuildPlan;
  pois?: POICategory[];
}

export default function MarketSection({ plan, pois }: MarketSectionProps) {
  const { market } = plan;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChart className="h-5 w-5" />
          Will it sell?
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Metric label="Indicative realisation (₹/sqft)"
                  value={`₹${market.pricePerSqFt.low.toLocaleString()}–${market.pricePerSqFt.high.toLocaleString()}`}
                  sub={`mid ~₹${market.pricePerSqFt.mid.toLocaleString()} · Island city factor applied: ${plan.plot.isIslandCity ? "yes" : "no"}`} />
          <Metric label="Absorption"
                  value={`${market.absorptionMonths.low}–${market.absorptionMonths.high} months`}
                  sub="Time to sell / lease typical stock in this submarket." />
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Comparables feed is coming. For now, submarket pricing bands reflect
            typical Mumbai ranges by infra type.
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <MapPinned className="h-4 w-4" />
            Nearby amenities (500m)
          </p>
          {!pois?.length ? (
            <p className="text-sm text-muted-foreground">
              Amenity snapshot unavailable for this plot.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {pois.slice(0, 6).map((c, i) => (
                <div key={i} className="rounded-md border bg-card px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{c.category}</span>
                    <Badge variant="outline">{c.count}</Badge>
                  </div>
                  {c.items[0] && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {c.items[0].name} · {c.items[0].distance}m
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
