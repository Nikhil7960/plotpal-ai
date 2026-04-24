// Mumbai approvals catalogue. Deterministic, always shown — shaped by context.

import type { Approval, EnvelopeResult, InfraType, PlotContext } from "./types";

function r(low: number, mid: number, high: number) {
  return { low, mid, high };
}

export function computeApprovals(
  ctx: PlotContext,
  infra: InfraType,
  envelope: EnvelopeResult
): Approval[] {
  const buaSqM = ctx.areaSqM * envelope.recommendedFSI;
  const requiresEC = buaSqM > 20000;
  const requiresAAI = !!ctx.inAirportFunnel || envelope.heightEstimateM > 30;
  const requiresCRZ = !!ctx.inCRZ;
  const requiresMHCC = !!ctx.inHeritagePrecinct;
  const isHospital = infra === "hospital";
  const isSchool = infra === "school";

  const list: Approval[] = [
    {
      key: "ioa", name: "Intimation of Approval (IOA)",
      authority: "MCGM Building Proposals",
      typicalTatMonths: r(2, 4, 7),
      required: true,
      gotcha: "Plans are scrutinised against DCPR 2034; concessions/objections are common.",
    },
    {
      key: "cc", name: "Commencement Certificate (CC)",
      authority: "MCGM Building Proposals",
      typicalTatMonths: r(1, 2, 4),
      required: true,
      gotcha: "Issued after IOA conditions are satisfied; premium payments finalised here.",
    },
    {
      key: "oc", name: "Occupation Certificate (OC)",
      authority: "MCGM Building Proposals",
      typicalTatMonths: r(2, 3, 6),
      required: true,
      gotcha: "Part OCs possible for phased handover — negotiate upfront.",
    },
    {
      key: "rera", name: "MahaRERA Registration",
      authority: "MahaRERA",
      typicalTatMonths: r(0.5, 1, 2),
      indicativeCostRange: r(0.5, 1.2, 2.5),
      required: ["residential", "retail", "office", "mall", "hotel"].includes(infra),
      gotcha: "Mandatory before marketing > 500 sqm or > 8 units.",
    },
    {
      key: "fire", name: "Fire NOC",
      authority: "Mumbai Fire Brigade",
      typicalTatMonths: r(1, 2, 4),
      indicativeCostRange: r(0.8, 2, 4),
      required: envelope.heightEstimateM >= 15 || ["hospital", "hotel", "mall", "school"].includes(infra),
      gotcha: "Two-stage (provisional + final); refusal common for blocked approach for fire tenders.",
    },
    {
      key: "tree", name: "Tree Authority NOC",
      authority: "MCGM Tree Authority",
      typicalTatMonths: r(0.5, 1.5, 3),
      indicativeCostRange: r(0.3, 0.8, 2),
      required: true,
      gotcha: "Replanting ratio is typically 1:3. Activist petitions are a real delay risk.",
    },
  ];

  if (requiresEC) {
    list.push({
      key: "ec", name: "Environmental Clearance",
      authority: "SEIAA Maharashtra",
      typicalTatMonths: r(4, 8, 14),
      indicativeCostRange: r(3, 7, 15),
      required: true,
      triggerReason: `Built-up area ${Math.round(buaSqM).toLocaleString()} m² > 20,000 m².`,
      gotcha: "Public hearing + EIA consultant; often the critical path item.",
    });
  }
  if (requiresAAI) {
    list.push({
      key: "aai", name: "AAI Height Clearance",
      authority: "Airports Authority of India",
      typicalTatMonths: r(2, 4, 8),
      required: true,
      triggerReason: ctx.inAirportFunnel
        ? "Plot lies within CSMIA airport funnel."
        : `Building height ~${envelope.heightEstimateM}m triggers AAI review.`,
      gotcha: "Can clip floors silently — review before paying premium FSI.",
    });
  }
  if (requiresCRZ) {
    list.push({
      key: "crz", name: "CRZ Clearance (MCZMA)",
      authority: "Maharashtra Coastal Zone Management Authority",
      typicalTatMonths: r(3, 6, 12),
      required: true,
      triggerReason: "Plot within Coastal Regulation Zone.",
      gotcha: "CRZ-II allows urban dev; CRZ-I/III severely restrict — classification matters.",
    });
  }
  if (requiresMHCC) {
    list.push({
      key: "mhcc", name: "Heritage Committee (MHCC) Approval",
      authority: "Mumbai Heritage Conservation Committee",
      typicalTatMonths: r(3, 6, 12),
      required: true,
      triggerReason: "Plot in notified heritage precinct.",
      gotcha: "Facade, massing, colour palette all dictated; timelines unpredictable.",
    });
  }
  if (isHospital) {
    list.push({
      key: "hospital-reg", name: "Nursing Home / Hospital Registration",
      authority: "BMC Public Health Dept",
      typicalTatMonths: r(2, 4, 8),
      required: true,
      gotcha: "BMC registration + Bombay Nursing Homes Act compliance.",
    });
  }
  if (isSchool) {
    list.push({
      key: "school-reg", name: "School Recognition",
      authority: "Maharashtra Education Department",
      typicalTatMonths: r(4, 8, 14),
      required: true,
      gotcha: "Affiliation (SSC/CBSE/ICSE) runs in parallel and can gate admissions.",
    });
  }

  return list;
}
