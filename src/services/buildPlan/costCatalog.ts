// Mumbai construction cost baselines for 2026 — ₹/sqft, seeded from published
// ranges (NoBroker / JK Cement / Housewise). These are **ranges**, always
// presented as low/mid/high to the user.

import type {
  Ambition, CostBreakdown, CostLine, EnvelopeResult, InfraType, PlotContext,
  Preferences, Range, Scenario,
} from "./types";

// ₹/sqft of built-up area, by infra × ambition. Lakh conversion: 1 lakh = 1e5.
// Source blend: residential standard 2500-4000, premium >4000, luxury >6500.
const BASE_PER_SQFT: Record<InfraType, Record<Ambition, Range>> = {
  residential: {
    modest:   { low: 1800, mid: 2100, high: 2500 },
    standard: { low: 2700, mid: 3200, high: 3800 },
    premium:  { low: 4000, mid: 5000, high: 6500 },
    landmark: { low: 6500, mid: 8500, high: 12000 },
  },
  office: {
    modest:   { low: 2400, mid: 2900, high: 3400 },
    standard: { low: 3400, mid: 4100, high: 4900 },
    premium:  { low: 5000, mid: 6200, high: 7800 },
    landmark: { low: 7800, mid: 9500, high: 13000 },
  },
  retail: {
    modest:   { low: 2600, mid: 3100, high: 3600 },
    standard: { low: 3600, mid: 4300, high: 5100 },
    premium:  { low: 5200, mid: 6500, high: 8000 },
    landmark: { low: 8000, mid: 10000, high: 14000 },
  },
  mall: {
    modest:   { low: 3200, mid: 3800, high: 4500 },
    standard: { low: 4500, mid: 5300, high: 6300 },
    premium:  { low: 6300, mid: 7500, high: 9200 },
    landmark: { low: 9200, mid: 11000, high: 15000 },
  },
  hotel: {
    modest:   { low: 3500, mid: 4100, high: 4900 },
    standard: { low: 4900, mid: 5800, high: 7000 },
    premium:  { low: 7000, mid: 8500, high: 10500 },
    landmark: { low: 10500, mid: 13000, high: 18000 },
  },
  hospital: {
    modest:   { low: 3800, mid: 4500, high: 5300 },
    standard: { low: 5300, mid: 6200, high: 7400 },
    premium:  { low: 7400, mid: 8800, high: 10800 },
    landmark: { low: 10800, mid: 13500, high: 18000 },
  },
  school: {
    modest:   { low: 2200, mid: 2600, high: 3100 },
    standard: { low: 3100, mid: 3700, high: 4400 },
    premium:  { low: 4400, mid: 5200, high: 6400 },
    landmark: { low: 6400, mid: 7800, high: 10500 },
  },
  gym: {
    modest:   { low: 2400, mid: 2900, high: 3400 },
    standard: { low: 3400, mid: 4100, high: 4800 },
    premium:  { low: 4800, mid: 5800, high: 7100 },
    landmark: { low: 7100, mid: 8800, high: 12000 },
  },
  cafe: {
    modest:   { low: 2200, mid: 2700, high: 3200 },
    standard: { low: 3200, mid: 3900, high: 4600 },
    premium:  { low: 4600, mid: 5600, high: 6800 },
    landmark: { low: 6800, mid: 8500, high: 11500 },
  },
  restaurant: {
    modest:   { low: 2500, mid: 3000, high: 3500 },
    standard: { low: 3500, mid: 4200, high: 5000 },
    premium:  { low: 5000, mid: 6000, high: 7400 },
    landmark: { low: 7400, mid: 9000, high: 12500 },
  },
  park: {
    modest:   { low: 300, mid: 400, high: 500 },
    standard: { low: 500, mid: 650, high: 800 },
    premium:  { low: 800, mid: 1000, high: 1300 },
    landmark: { low: 1300, mid: 1700, high: 2400 },
  },
};

// Cost composition by category — fractions of the all-in per-sqft number.
// Tracks the 40/25/15/12/8 split mentioned in the 2026 India cost breakdowns,
// with a tweak for Mumbai-heavy soft costs.
const HARD_SHARE = { structure: 0.36, finishes: 0.22, mep: 0.16 };
const SOFT_SHARE = { design: 0.04, pmc: 0.03, legalRera: 0.02 };
const APPROVAL_SHARE = { premiums: 0.08, nocs: 0.02 };
const FINANCE_SHARE = 0.05;
const CONTINGENCY_SHARE = 0.02;
// (sum ≈ 1.00; Mumbai reality floats; we anchor to base cost then add premiums separately for FSI.)

function applyScenario(r: Range, s: Scenario): Range {
  switch (s) {
    case "optimistic":   return { low: r.low * 0.92, mid: r.mid * 0.95, high: r.high * 0.97 };
    case "conservative": return { low: r.low * 1.08, mid: r.mid * 1.12, high: r.high * 1.18 };
    default: return r;
  }
}

// Premium FSI is purchased at a % of ASR (Annual Schedule of Rates).
// Napkin: treat premium FSI cost as ₹/sqft × ASR factor.
function premiumFsiCostLakh(
  envelope: EnvelopeResult,
  ctx: PlotContext
): Range {
  const premiumBuaSqM = ctx.areaSqM * envelope.premiumFSIAvailable;
  const premiumBuaSqFt = premiumBuaSqM * 10.7639;
  // Rough ASR-premium proxy: ₹ per sqft of premium FSI BUA.
  // Island ₹3000-6000, Suburb ₹1500-3500. Heavily location-dependent.
  const rate = ctx.isIslandCity
    ? { low: 3000, mid: 4500, high: 6000 }
    : { low: 1500, mid: 2500, high: 3500 };
  return {
    low:  (premiumBuaSqFt * rate.low) / 1e5,
    mid:  (premiumBuaSqFt * rate.mid) / 1e5,
    high: (premiumBuaSqFt * rate.high) / 1e5,
  };
}

function line(key: string, label: string, r: Range, note?: string, assumption?: string): CostLine {
  return { key, label, range: round(r), note, assumption };
}
function round(r: Range): Range {
  return {
    low: +r.low.toFixed(1),
    mid: +r.mid.toFixed(1),
    high: +r.high.toFixed(1),
  };
}
function sum(...rs: Range[]): Range {
  return rs.reduce(
    (a, b) => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }),
    { low: 0, mid: 0, high: 0 }
  );
}
function scale(r: Range, k: number): Range {
  return { low: r.low * k, mid: r.mid * k, high: r.high * k };
}

export function computeCost(
  ctx: PlotContext,
  infra: InfraType,
  envelope: EnvelopeResult,
  prefs: Preferences,
  scenario: Scenario
): CostBreakdown {
  const buaSqFt = envelope.buildableAreaSqM * 10.7639;
  const perSqFt = applyScenario(BASE_PER_SQFT[infra][prefs.ambition], scenario);

  // Each share is a fraction of the all-in cost; rebuild slices from the
  // per-sqft anchor then convert to ₹ lakh via built-up area.
  const hardStructure = scale(perSqFt, HARD_SHARE.structure);
  const hardFinishes = scale(perSqFt, HARD_SHARE.finishes);
  const hardMep = scale(perSqFt, HARD_SHARE.mep);

  const toLakh = (r: Range) => scale(r, buaSqFt / 1e5);

  const hard: CostLine[] = [
    line("structure", "Structure (RCC, brick, foundation)", toLakh(hardStructure),
      "~36% of hard cost. Mumbai adds ~12% for piling on reclaimed soil if applicable."),
    line("finishes", "Finishes (flooring, paint, doors/windows)", toLakh(hardFinishes),
      "~22% of hard cost; luxury grades swing this the most."),
    line("mep", "MEP (electrical, plumbing, HVAC, fire)", toLakh(hardMep),
      "~16% of hard cost; hospital/mall skew higher."),
  ];

  const soft: CostLine[] = [
    line("design", "Architect + consultants", toLakh(scale(perSqFt, SOFT_SHARE.design)),
      "4% of all-in is typical for Mumbai mid-scale."),
    line("pmc", "Project management (PMC)", toLakh(scale(perSqFt, SOFT_SHARE.pmc)),
      "Covers site PM, QS, safety."),
    line("legalRera", "Legal + MahaRERA + title", toLakh(scale(perSqFt, SOFT_SHARE.legalRera)),
      "MahaRERA registration + legal diligence."),
  ];

  const premiumFSILakh = premiumFsiCostLakh(envelope, ctx);
  const approvalsNocs = toLakh(scale(perSqFt, APPROVAL_SHARE.nocs));

  const approvals: CostLine[] = [
    line("premiumFsi", "Premium FSI purchase (indicative)", premiumFSILakh,
      `Based on ${envelope.premiumFSIAvailable.toFixed(2)} premium FSI × ASR-proxy rate.`,
      "Premium FSI priced as ₹/sqft × ASR factor — replace with ward-specific ASR when available."),
    line("nocs", "Approvals & NOCs (IOD/CC/OC + Fire/Tree/Environment)", approvalsNocs,
      "IOA, CC, OC, Fire NOC, Tree Authority, and EC if > 20,000 sqm."),
  ];

  // Helper: extract ranges from a list of CostLines for summation.
  const rangesOf = (lines: CostLine[]) => lines.map(l => l.range);

  // Financing: interest accrued during build on 60% weighted capital base.
  const financingBase = sum(...rangesOf(hard), ...rangesOf(soft));
  const financing: CostLine[] = [
    line("financing", "Financing cost (interest during build)",
      scale(financingBase, FINANCE_SHARE * 0.6),
      "Assumes 10-12% blended cost × 60% weighted capital base × 18-24 months."),
  ];

  const subtotalLakh = sum(
    ...rangesOf(hard), ...rangesOf(soft),
    ...rangesOf(approvals), ...rangesOf(financing),
  );
  const contingency = line("contingency", "Contingency (10%)",
    scale(subtotalLakh, 0.1),
    "Mumbai projects that skip contingency regret it — monsoon + labour volatility.");

  const total = sum(subtotalLakh, contingency.range);
  const perSqFtLive: Range = {
    low:  (total.low * 1e5) / buaSqFt,
    mid:  (total.mid * 1e5) / buaSqFt,
    high: (total.high * 1e5) / buaSqFt,
  };

  return {
    hard, soft, approvals, financing, contingency,
    total: round(total),
    perSqFt: round(perSqFtLive),
  };
}

export function formatINR(lakhs: number): string {
  if (lakhs >= 100) {
    const cr = lakhs / 100;
    return `₹${cr.toFixed(cr >= 10 ? 1 : 2)} Cr`;
  }
  return `₹${lakhs.toFixed(1)} L`;
}

export function formatRangeINR(r: Range): string {
  return `${formatINR(r.low)} – ${formatINR(r.high)}`;
}
