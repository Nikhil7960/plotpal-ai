// Core types for the Phase 2 "Build Plan" generator.
// Deterministic numbers live here — no LLM output is typed as a financial figure.

export type InfraType =
  | "cafe" | "mall" | "park" | "residential" | "office"
  | "hospital" | "school" | "gym" | "restaurant" | "hotel" | "retail";

export type Ambition = "modest" | "standard" | "premium" | "landmark";
export type Timeline = "fast" | "balanced" | "valueMax";
export type Aesthetic =
  | "modern" | "artDeco" | "biophilic" | "industrial" | "vernacular" | "luxury";

export type Scenario = "conservative" | "base" | "optimistic";

export interface PlotContext {
  lat: number;
  lng: number;
  address: string;
  ward?: string;
  // Assumed plot area in m². If the parcel polygon isn't available we
  // fall back to a grade-typical footprint for the selected infra type.
  areaSqM: number;
  // Whether this plot lives in Mumbai Island City (True) or Suburbs (false).
  // Island is 1.33 basic FSI, Suburbs 1.00 per DCPR 2034.
  isIslandCity: boolean;
  // Width of the road fronting the plot in metres. Drives premium FSI tiers.
  roadWidthM: number;
  // Optional flags for red-flag detection.
  inCRZ?: boolean;
  inHeritagePrecinct?: boolean;
  inAirportFunnel?: boolean;
}

export interface Preferences {
  ambition: Ambition;
  useMix: UseMix;     // primary use breakdown 0..1 weights, sums to 1
  budgetCapINR?: number; // undefined → "show me what it would cost"
  timeline: Timeline;
  aesthetic: Aesthetic;
}

export interface UseMix {
  residential: number;
  retail: number;
  office: number;
  amenity: number;
}

export interface Range<T = number> {
  low: T;
  mid: T;
  high: T;
}

// FSI / envelope
export interface EnvelopeResult {
  basicFSI: number;
  premiumFSIAvailable: number;   // cap the user may purchase
  tdrAvailable: number;
  maxPermissibleFSI: number;
  recommendedFSI: number;         // our suggested utilisation given ambition
  buildableAreaSqM: number;       // plot × recommended FSI × efficiency
  approxFloors: number;
  heightEstimateM: number;
  setbacks: { front: number; side: number; rear: number };
  footprintEfficiency: number;    // after setbacks / plot area
  notes: string[];
}

// Cost
export interface CostLine {
  key: string;
  label: string;
  range: Range;               // ₹ lakh; use lakh internally to keep math simple
  note?: string;
  assumption?: string;
}
export interface CostBreakdown {
  hard: CostLine[];           // structure, finishes, MEP
  soft: CostLine[];           // architect, PMC, legal, RERA
  approvals: CostLine[];      // premium FSI, NOCs
  financing: CostLine[];
  contingency: CostLine;
  total: Range;               // lakh
  perSqFt: Range;             // ₹
}

// Approvals
export interface Approval {
  key: string;
  name: string;
  authority: string;
  typicalTatMonths: Range;
  indicativeCostRange?: Range;       // ₹ lakh
  required: boolean;
  triggerReason?: string;
  gotcha?: string;
}

// Materials / BoQ
export interface BoqItem {
  key: string;
  label: string;
  unit: string;
  quantity: Range;
  note?: string;
}

// Timeline
export interface TimelinePhase {
  key: string;
  label: string;
  startMonth: number;    // months from t0
  durationMonths: number;
  swimlane: "approvals" | "foundation" | "structure" | "mep" | "finishes";
  critical: boolean;
}

// Market snapshot
export interface MarketSnapshot {
  pricePerSqFt: Range;              // ₹
  absorptionMonths: Range;
  breakEvenOccupancyPct?: number;
  comparables: Array<{
    name: string; distanceM: number; pricePerSqFt?: number; note?: string;
  }>;
}

// Risks
export interface RiskItem {
  key: string;
  axis: "regulatory" | "market" | "execution" | "financial" | "environmental";
  level: 1 | 2 | 3 | 4 | 5;     // 1 = low, 5 = high
  title: string;
  detail: string;
  mitigation?: string;
}

export interface BuildPlan {
  plot: PlotContext;
  infra: InfraType;
  preferences: Preferences;
  scenario: Scenario;
  envelope: EnvelopeResult;
  cost: CostBreakdown;
  approvals: Approval[];
  materials: BoqItem[];
  timeline: TimelinePhase[];
  market: MarketSnapshot;
  risks: RiskItem[];
  confidence: "napkin" | "indicative" | "detailed";
  redFlags: string[];
}
