import { computeEnvelope } from "./dcprRules";
import { computeCost } from "./costCatalog";
import { computeApprovals } from "./approvalsCatalog";
import { computeMaterials } from "./materialsCatalog";
import { computeTimeline } from "./timelineGenerator";
import { computeMarket, computeRisks, detectRedFlags } from "./risksAndMarket";
import type {
  BuildPlan, InfraType, PlotContext, Preferences, Scenario,
} from "./types";

export function generateBuildPlan(args: {
  plot: PlotContext;
  infra: InfraType;
  preferences: Preferences;
  scenario?: Scenario;
}): BuildPlan {
  const scenario = args.scenario ?? "base";
  const envelope = computeEnvelope(args.plot, args.infra, args.preferences.ambition);
  const approvals = computeApprovals(args.plot, args.infra, envelope);
  const cost = computeCost(args.plot, args.infra, envelope, args.preferences, scenario);
  const materials = computeMaterials(envelope, args.infra);
  const timeline = computeTimeline(envelope, args.infra, approvals, args.preferences);
  const market = computeMarket(args.plot, args.infra, envelope);
  const risks = computeRisks(args.plot, args.infra, envelope, cost, args.preferences);
  const redFlags = detectRedFlags(args.plot, envelope, args.infra);

  const confidence: BuildPlan["confidence"] =
    args.plot.areaSqM > 0 && args.plot.roadWidthM > 0 ? "indicative" : "napkin";

  return {
    plot: args.plot,
    infra: args.infra,
    preferences: args.preferences,
    scenario,
    envelope,
    cost,
    approvals,
    materials,
    timeline,
    market,
    risks,
    confidence,
    redFlags,
  };
}

// Defaults for when a user arrives without full preferences.
export const DEFAULT_PREFERENCES: Preferences = {
  ambition: "standard",
  useMix: { residential: 1, retail: 0, office: 0, amenity: 0 },
  timeline: "balanced",
  aesthetic: "modern",
};
