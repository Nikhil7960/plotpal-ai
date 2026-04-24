// Timeline generator — produces a Gantt-ready set of phases with monsoon
// awareness. Mumbai loses ~4 months of external work per year; we express
// that by stretching phases that span June-September.

import type {
  Approval, EnvelopeResult, InfraType, Preferences, TimelinePhase,
} from "./types";

function baseDuration(envelope: EnvelopeResult, infra: InfraType) {
  const floors = Math.max(1, envelope.approxFloors);
  const structureMonths = Math.ceil(floors * (infra === "hospital" ? 1.0 : 0.8));
  const foundationMonths = Math.max(2, Math.round(floors * 0.3));
  const mepMonths = Math.max(3, Math.round(floors * 0.5));
  const finishMonths = Math.max(3, Math.round(floors * 0.55));
  return { foundationMonths, structureMonths, mepMonths, finishMonths };
}

function approvalsMonths(approvals: Approval[], prefs: Preferences): number {
  // Use the slowest critical approval's mid TAT as the gating item.
  const slowest = approvals.reduce(
    (max, a) => Math.max(max, a.typicalTatMonths.mid),
    3 // minimum
  );
  if (prefs.timeline === "fast") return Math.round(slowest * 0.75);
  if (prefs.timeline === "valueMax") return Math.round(slowest * 1.1);
  return Math.round(slowest);
}

// Inflate duration slightly if the phase window overlaps monsoon (Jun-Sep).
// We assume construction start = t0 at April of year 1 (start-of-financial year).
function monsoonAdjust(startMonth: number, durationMonths: number) {
  let added = 0;
  for (let m = startMonth; m < startMonth + durationMonths; m++) {
    const monthOfYear = (m + 3) % 12; // 0=April, shift for Jun-Sep = 2..5
    if (monthOfYear >= 2 && monthOfYear <= 5) added += 0.25; // 25% slowdown
  }
  return Math.ceil(durationMonths + added);
}

export function computeTimeline(
  envelope: EnvelopeResult,
  infra: InfraType,
  approvals: Approval[],
  prefs: Preferences
): TimelinePhase[] {
  const { foundationMonths, structureMonths, mepMonths, finishMonths } =
    baseDuration(envelope, infra);
  const approvalsM = approvalsMonths(approvals, prefs);

  const phases: TimelinePhase[] = [];

  phases.push({
    key: "approvals", label: "Approvals & permits",
    startMonth: 0, durationMonths: approvalsM,
    swimlane: "approvals", critical: true,
  });

  // Foundation starts slightly before approvals fully close (can start mobilisation)
  const foundStart = Math.max(0, approvalsM - 1);
  const foundDur = monsoonAdjust(foundStart, foundationMonths);
  phases.push({
    key: "foundation", label: "Excavation + foundation",
    startMonth: foundStart, durationMonths: foundDur,
    swimlane: "foundation", critical: true,
  });

  const structStart = foundStart + foundDur;
  const structDur = monsoonAdjust(structStart, structureMonths);
  phases.push({
    key: "structure", label: "Superstructure (RCC)",
    startMonth: structStart, durationMonths: structDur,
    swimlane: "structure", critical: true,
  });

  const mepStart = structStart + Math.max(2, Math.round(structDur * 0.4));
  const mepDur = mepMonths;
  phases.push({
    key: "mep", label: "MEP rough-in",
    startMonth: mepStart, durationMonths: mepDur,
    swimlane: "mep", critical: false,
  });

  const finishStart = structStart + structDur - 1;
  const finishDur = finishMonths;
  phases.push({
    key: "finishes", label: "Finishes + fit-out",
    startMonth: finishStart, durationMonths: finishDur,
    swimlane: "finishes", critical: true,
  });

  return phases;
}

export function timelineTotalMonths(phases: TimelinePhase[]): number {
  return phases.reduce((max, p) => Math.max(max, p.startMonth + p.durationMonths), 0);
}

// Months of the year 0-11 (Jan = 0) that fall within a phase that started
// at t0 = April. Used to overlay monsoon bands.
export function monsoonMonthsInRange(startMonth: number, durationMonths: number) {
  const out: number[] = [];
  for (let m = startMonth; m < startMonth + durationMonths; m++) {
    const monthOfYear = (m + 3) % 12;
    if (monthOfYear >= 2 && monthOfYear <= 5) out.push(m);
  }
  return out;
}
