// Simplified DCPR 2034 rule engine for Mumbai.
// These are napkin-math rules — sufficient for a feasibility preview, not
// legal advice. Numbers are derived from publicly published summaries
// (Archonet / MCHI / Kutir Group research).

import type {
  Ambition, EnvelopeResult, InfraType, PlotContext,
} from "./types";

// Basic FSI per DCPR 2034
function basicFSI(ctx: PlotContext): number {
  return ctx.isIslandCity ? 1.33 : 1.0;
}

// Premium FSI cap based on road width (metres).
// Island: up to 0.84; Suburb: up to 0.50. Premium is only sold on roads ≥ 9m.
function premiumFSI(ctx: PlotContext): number {
  if (ctx.roadWidthM < 9) return 0;
  const islandCap = 0.84;
  const suburbCap = 0.5;
  const cap = ctx.isIslandCity ? islandCap : suburbCap;
  // Tiered by road width: 9m → ~40% of cap, 12m → 70%, 18m+ → 100%.
  const frac =
    ctx.roadWidthM >= 18 ? 1.0 :
    ctx.roadWidthM >= 12 ? 0.7 : 0.4;
  return +(cap * frac).toFixed(2);
}

// TDR cap depending on road width.
function tdrFSI(ctx: PlotContext): number {
  if (ctx.roadWidthM < 9) return 0;
  const islandCap = 0.83;
  const suburbCap = 0.9;
  const cap = ctx.isIslandCity ? islandCap : suburbCap;
  const frac =
    ctx.roadWidthM >= 18 ? 1.0 :
    ctx.roadWidthM >= 12 ? 0.65 : 0.35;
  return +(cap * frac).toFixed(2);
}

function maxPermissibleFSI(ctx: PlotContext): number {
  // Island cap 3.0, Suburb cap 2.4 per DCPR 2034.
  return ctx.isIslandCity ? 3.0 : 2.4;
}

// Typical floor-to-floor in metres by infra type.
const FLOOR_HEIGHT_M: Record<InfraType, number> = {
  residential: 3.0, cafe: 3.6, restaurant: 3.6, retail: 4.0,
  office: 3.3, hospital: 3.9, school: 3.6, gym: 4.2,
  mall: 4.5, hotel: 3.3, park: 0,
};

// Efficiency factor (saleable / built-up) for computing buildable area.
// This is a blended shortcut; real projects decompose carpet/built-up/RERA.
const EFFICIENCY: Record<InfraType, number> = {
  residential: 0.78, office: 0.75, retail: 0.7, cafe: 0.72, restaurant: 0.72,
  hospital: 0.68, school: 0.72, gym: 0.75, mall: 0.65, hotel: 0.7, park: 1.0,
};

function ambitionFSIFactor(a: Ambition): number {
  switch (a) {
    case "modest": return 0.6;
    case "standard": return 0.85;
    case "premium": return 0.95;
    case "landmark": return 1.0;
  }
}

// Footprint occupancy as a fraction of plot area, by typology.
// Towers (residential/office/hotel) occupy a small share and go tall;
// horizontal programs (mall/school/hospital) occupy more and stay low.
const FOOTPRINT_BY_TYPE: Record<InfraType, number> = {
  residential: 0.32, office: 0.30, hotel: 0.30,
  hospital: 0.55, school: 0.55, mall: 0.60,
  retail: 0.65, cafe: 0.70, restaurant: 0.70, gym: 0.60,
  park: 1.0,
};

// Setbacks based on plot area + road width (simplified from DCPR schedule).
function setbacksFor(ctx: PlotContext) {
  const base = ctx.areaSqM >= 4000 ? 6 : ctx.areaSqM >= 1000 ? 4.5 : 3.0;
  const front = Math.max(base, ctx.roadWidthM < 12 ? 3 : 4.5);
  const side = base;
  const rear = base;
  return { front, side, rear };
}

export function computeEnvelope(
  ctx: PlotContext,
  infra: InfraType,
  ambition: Ambition
): EnvelopeResult {
  const basic = basicFSI(ctx);
  const premium = premiumFSI(ctx);
  const tdr = tdrFSI(ctx);
  const hardCap = maxPermissibleFSI(ctx);
  const theoreticalMax = Math.min(basic + premium + tdr, hardCap);
  const recommendedFSI = +(theoreticalMax * ambitionFSIFactor(ambition)).toFixed(2);

  const setbacks = setbacksFor(ctx);
  // Typology-driven footprint fraction, further reduced on very small plots
  // where setbacks eat more relative area.
  const plotSizeFactor = ctx.areaSqM < 400 ? 0.85 :
                         ctx.areaSqM < 1000 ? 0.9 : 1.0;
  const footprintEfficiency = +Math.min(
    0.8, Math.max(0.18, (FOOTPRINT_BY_TYPE[infra] ?? 0.4) * plotSizeFactor)
  ).toFixed(2);
  const usableFootprintM2 = ctx.areaSqM * footprintEfficiency;

  const builtUpM2 = ctx.areaSqM * recommendedFSI;
  const saleableM2 = builtUpM2 * (EFFICIENCY[infra] ?? 0.72);

  const floorH = FLOOR_HEIGHT_M[infra] || 3.3;
  const approxFloors = infra === "park" ? 0 :
    Math.max(1, Math.round(builtUpM2 / Math.max(usableFootprintM2, 50)));
  const heightEstimateM = approxFloors * floorH;

  const notes: string[] = [];
  if (premium === 0 && ctx.roadWidthM < 9)
    notes.push(`Premium FSI is unavailable — road frontage is under 9m.`);
  if (ctx.roadWidthM < 12)
    notes.push(`Road width ${ctx.roadWidthM}m caps premium FSI at ~40%.`);
  if (recommendedFSI >= hardCap - 0.05)
    notes.push(`Utilising near-max FSI — budget for TDR premium + aggressive massing.`);
  if (ctx.inAirportFunnel)
    notes.push(`Plot is inside CSMIA airport funnel — AAI height clearance will clip upper floors.`);
  if (ctx.inCRZ)
    notes.push(`CRZ overlay detected — envelope may be further restricted.`);
  if (ctx.inHeritagePrecinct)
    notes.push(`Heritage precinct — MHCC approval required; facade dictated by guidelines.`);

  return {
    basicFSI: basic,
    premiumFSIAvailable: premium,
    tdrAvailable: tdr,
    maxPermissibleFSI: hardCap,
    recommendedFSI,
    buildableAreaSqM: Math.round(saleableM2),
    approxFloors,
    heightEstimateM: +heightEstimateM.toFixed(1),
    setbacks,
    footprintEfficiency: +footprintEfficiency.toFixed(2),
    notes,
  };
}
