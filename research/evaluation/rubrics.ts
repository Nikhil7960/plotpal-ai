export const RUBRIC_DIMENSIONS = [
  'relevance',
  'feasibility',
  'reasoning_quality',
  'geographic_accuracy',
  'completeness',
] as const;

export type RubricDimension = typeof RUBRIC_DIMENSIONS[number];

export const RUBRICS: Record<RubricDimension, string> = {
  relevance: `**Relevance** — Are identified spaces actually vacant or available for development?
1: All spaces are occupied buildings, water, or roads — none are genuinely vacant
2: Most spaces are misidentified; only 1 might be truly vacant
3: About half the spaces appear genuinely vacant or underutilized
4: Most spaces are genuinely vacant/underutilized; minor misidentifications
5: All identified spaces are clearly vacant, abandoned, or underutilized`,

  feasibility: `**Feasibility** — Are recommended infrastructure types appropriate?
1: Recommendations ignore lot size, context, and zoning entirely
2: Most recommendations are impractical (e.g., hospital on tiny lot)
3: Some recommendations are reasonable but others clearly don't fit
4: Most recommendations are well-suited to lot size and neighborhood context
5: All recommendations are highly appropriate, considering size, access, and surroundings`,

  reasoning_quality: `**Reasoning Quality** — Are reasons specific and evidence-based?
1: Generic boilerplate only ("good location", "accessible area")
2: Mostly generic with one specific observation
3: Mix of generic and specific reasons citing visible features
4: Most reasons cite specific visible features, landmarks, or spatial relationships
5: All reasons are specific, citing concrete visible evidence from the satellite image`,

  geographic_accuracy: `**Geographic Accuracy** — Are coordinates within the cell and consistent?
1: Coordinates are outside the 500m cell or clearly wrong
2: Some coordinates are outside the cell or significantly off
3: Coordinates are within the cell but don't match described locations well
4: Coordinates are within the cell and generally match descriptions
5: Coordinates precisely match described locations within the cell`,

  completeness: `**Completeness** — Are all fields present with rich detail?
1: Most fields missing or empty; minimal descriptions
2: Fields present but sparse (one-word reasons, no considerations)
3: Adequate detail in most fields; some thin areas
4: Rich detail in most fields; descriptions are informative
5: All fields thoroughly populated; descriptions, reasons, and considerations are detailed`,
};

export function getFullRubricText(): string {
  return Object.values(RUBRICS).join('\n\n');
}
