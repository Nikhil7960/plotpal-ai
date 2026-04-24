// Napkin-math BoQ generator. Seeded from Indian construction thumb rules:
// cement ~0.4 bag / sqft built-up, steel ~4 kg / sqft, aggregate 1.35 cft / sqft.
// Ranges ±20% to communicate uncertainty.

import type { BoqItem, EnvelopeResult, InfraType } from "./types";

function rng(mid: number, jitterPct = 0.2) {
  return {
    low: +(mid * (1 - jitterPct)).toFixed(1),
    mid: +mid.toFixed(1),
    high: +(mid * (1 + jitterPct)).toFixed(1),
  };
}

const TYPE_MULT: Record<InfraType, number> = {
  residential: 1.0, office: 1.05, retail: 1.1, cafe: 0.95, restaurant: 1.0,
  hospital: 1.25, school: 1.05, gym: 1.05, mall: 1.2, hotel: 1.15, park: 0.2,
};

export function computeMaterials(
  envelope: EnvelopeResult,
  infra: InfraType
): BoqItem[] {
  const buaSqFt = envelope.buildableAreaSqM * 10.7639;
  const m = TYPE_MULT[infra] ?? 1;

  const cementBags = 0.4 * buaSqFt * m;
  const steelKg = 4.0 * buaSqFt * m;
  const aggregateCft = 1.35 * buaSqFt * m;
  const brickPieces = 8 * buaSqFt * m;     // ~8 standard bricks/sqft
  const sandCft = 1.3 * buaSqFt * m;
  const tilesSqFt = 0.55 * buaSqFt * m;    // flooring + walls weighted
  const paintLitres = 0.2 * buaSqFt * m;   // interior + exterior blended
  const glassSqFt = infra === "office" || infra === "mall" || infra === "hotel"
    ? 0.35 * buaSqFt : 0.08 * buaSqFt;
  const kvaLoad = buaSqFt * (infra === "hospital" ? 0.008 :
                             infra === "mall" || infra === "hotel" ? 0.006 :
                             infra === "office" ? 0.005 : 0.003);
  const waterKL = buaSqFt * (infra === "hospital" ? 0.012 :
                             infra === "hotel" ? 0.01 :
                             infra === "residential" ? 0.007 : 0.004);
  const labourMandays = buaSqFt * 0.18 * m;

  const items: BoqItem[] = [
    { key: "cement", label: "Cement", unit: "bags (50kg)", quantity: rng(cementBags),
      note: "~0.4 bag per sqft built-up. Monsoon storage adds ~3%." },
    { key: "steel", label: "TMT steel", unit: "tonnes", quantity: rng(steelKg / 1000),
      note: "~4 kg per sqft. Fe500/Fe550 for Mumbai seismic zone III." },
    { key: "aggregate", label: "Stone aggregate", unit: "cft", quantity: rng(aggregateCft) },
    { key: "brick", label: "Bricks / blocks", unit: "pieces", quantity: rng(brickPieces),
      note: "Switch to AAC blocks for weight savings + insulation." },
    { key: "sand", label: "Sand", unit: "cft", quantity: rng(sandCft),
      note: "Mumbai: river-sand scarcity → crushed sand typical." },
    { key: "tiles", label: "Floor + wall tiles", unit: "sqft", quantity: rng(tilesSqFt) },
    { key: "paint", label: "Paint", unit: "litres", quantity: rng(paintLitres),
      note: "Salt-resistant exterior paint is a must for coastal Mumbai." },
    { key: "glass", label: "Glazing (facade/windows)", unit: "sqft", quantity: rng(glassSqFt),
      note: "DGU + low-E recommended for heat load reduction." },
    { key: "kva", label: "Estimated power load", unit: "kVA",
      quantity: rng(kvaLoad, 0.25),
      note: "Sanctioned load; solar rooftop can offset ~20-30%." },
    { key: "water", label: "Daily water demand", unit: "kL/day",
      quantity: rng(waterKL, 0.25),
      note: "Consider dual plumbing + STP for recycled flush." },
    { key: "labour", label: "Labour (cumulative)", unit: "man-days",
      quantity: rng(labourMandays, 0.25),
      note: "Excludes specialist trades; skilled masons in Mumbai earn ₹800-1,200/day." },
  ];

  return items;
}

export function formatBoqQty(q: { low: number; mid: number; high: number }): string {
  // Compact formatting that preserves the range feel.
  const fmt = (n: number) => n >= 100000 ? `${(n / 1000).toFixed(0)}k` :
                             n >= 1000 ? `${(n / 1000).toFixed(1)}k` :
                             n.toFixed(n < 10 ? 1 : 0);
  return `${fmt(q.low)} – ${fmt(q.high)}`;
}
