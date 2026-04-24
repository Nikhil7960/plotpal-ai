// Risk scoring + lightweight market snapshot (without external paid APIs).

import type {
  EnvelopeResult, InfraType, MarketSnapshot, PlotContext, Preferences,
  RiskItem, Range, CostBreakdown,
} from "./types";

function r(low: number, mid: number, high: number) { return { low, mid, high }; }

// Market snapshot seeds — Mumbai-typical ₹/sqft ranges by infra, regardless
// of micro-location. (Will be replaced by real comps later.)
const PRICE_PER_SQFT_BASE: Record<InfraType, Range> = {
  residential: r(18000, 28000, 65000),
  office: r(15000, 22000, 45000),
  retail: r(25000, 45000, 120000),
  cafe: r(22000, 38000, 90000),
  restaurant: r(22000, 38000, 90000),
  mall: r(18000, 28000, 55000),
  hotel: r(20000, 35000, 80000),
  hospital: r(14000, 22000, 40000),
  school: r(10000, 18000, 30000),
  gym: r(18000, 30000, 60000),
  park: r(0, 0, 0),
};

export function computeMarket(
  ctx: PlotContext,
  infra: InfraType,
  envelope: EnvelopeResult
): MarketSnapshot {
  const base = PRICE_PER_SQFT_BASE[infra];
  // Island city premium.
  const mult = ctx.isIslandCity ? 1.3 : 1.0;
  const pricePerSqFt = {
    low:  Math.round(base.low * mult),
    mid:  Math.round(base.mid * mult),
    high: Math.round(base.high * mult),
  };
  return {
    pricePerSqFt,
    absorptionMonths: r(6, 14, 30),
    comparables: [], // populated downstream from OSM POIs / future real-comps API
  };
}

export function computeRisks(
  ctx: PlotContext,
  infra: InfraType,
  envelope: EnvelopeResult,
  cost: CostBreakdown,
  prefs: Preferences
): RiskItem[] {
  const risks: RiskItem[] = [];

  // Regulatory
  let regLevel: RiskItem["level"] = 2;
  const regReasons: string[] = [];
  if (ctx.inCRZ) { regLevel = 5; regReasons.push("CRZ overlay"); }
  if (ctx.inHeritagePrecinct) { regLevel = Math.max(regLevel, 4) as RiskItem["level"]; regReasons.push("Heritage precinct"); }
  if (ctx.inAirportFunnel) { regLevel = Math.max(regLevel, 4) as RiskItem["level"]; regReasons.push("Airport funnel"); }
  if (envelope.buildableAreaSqM > 20000) { regLevel = Math.max(regLevel, 3) as RiskItem["level"]; regReasons.push("EC threshold"); }
  risks.push({
    key: "regulatory", axis: "regulatory", level: regLevel,
    title: "Regulatory exposure",
    detail: regReasons.length
      ? `Triggers: ${regReasons.join(", ")}.`
      : "Standard MCGM pathway; assume normal IOA → CC → OC sequence.",
    mitigation: "Engage a liaison architect early; parallel-file approvals that don't block each other.",
  });

  // Execution
  let exLevel: RiskItem["level"] = envelope.approxFloors >= 15 ? 4 : envelope.approxFloors >= 8 ? 3 : 2;
  risks.push({
    key: "execution", axis: "execution", level: exLevel,
    title: "Execution complexity",
    detail: `${envelope.approxFloors}-floor ${infra} with ~${envelope.buildableAreaSqM.toLocaleString()} m² built-up.`,
    mitigation: "PMC with high-rise Mumbai track record; pre-qualify 3+ contractors.",
  });

  // Financial
  const totalCr = cost.total.mid / 100;
  const finLevel: RiskItem["level"] = totalCr >= 200 ? 5 : totalCr >= 75 ? 4 : totalCr >= 25 ? 3 : 2;
  risks.push({
    key: "financial", axis: "financial", level: finLevel,
    title: "Capital exposure",
    detail: `Mid-case capex ₹${totalCr.toFixed(1)} Cr. Steel/cement ±18% in 24 months.`,
    mitigation: "Fix 70% of BoQ via forward contracts; stage-gated funding release.",
  });

  // Market
  const mktLevel: RiskItem["level"] = infra === "mall" || infra === "hotel" ? 4 :
    infra === "park" ? 1 : 3;
  risks.push({
    key: "market", axis: "market", level: mktLevel,
    title: "Demand / absorption",
    detail: `${infra[0].toUpperCase() + infra.slice(1)} demand in Mumbai is ${
      mktLevel >= 4 ? "cyclical and sensitive to macro" : "generally resilient"
    }.`,
    mitigation: "Validate demand with a 500m radius POI + footfall scan; pre-lease ≥ 40% before tower top-out.",
  });

  // Environmental
  const envLevel: RiskItem["level"] = ctx.inCRZ ? 5 :
    envelope.buildableAreaSqM > 20000 ? 3 : 2;
  risks.push({
    key: "environmental", axis: "environmental", level: envLevel,
    title: "Environmental & climate",
    detail: "Mumbai monsoon + heat island + water-logged wards (H-E, F-S) hit timeline and lifecycle cost.",
    mitigation: "Raised plinth, rooftop solar, rainwater harvesting, STP + dual plumbing from day 1.",
  });

  return risks;
}

export function detectRedFlags(
  ctx: PlotContext, envelope: EnvelopeResult, infra: InfraType
): string[] {
  const flags: string[] = [];
  if (ctx.inCRZ) flags.push("Plot appears to be in a CRZ zone — verify CRZ classification before acquiring.");
  if (ctx.inHeritagePrecinct) flags.push("Heritage precinct overlay — MHCC dictates facade & massing.");
  if (ctx.inAirportFunnel && envelope.heightEstimateM > 15)
    flags.push("Airport funnel + estimated height > 15m — AAI may clip upper floors.");
  if (ctx.roadWidthM < 6)
    flags.push(`Road width ${ctx.roadWidthM}m — may be sub-minimum; fire tender access could fail.`);
  return flags;
}
