import { MUMBAI_BBOX } from '../config.js';
import { CellResult, PointwiseScore, MetricsSummary } from '../types.js';
import { EvaluationOutput } from '../evaluation/judge.js';
import * as calc from './calculator.js';

/**
 * Mumbai region classification based on latitude.
 */
function classifyRegion(lat: number): string {
  if (lat < 18.95) return 'South Mumbai';
  if (lat < 19.05) return 'Central Mumbai';
  if (lat < 19.15) return 'Western Suburbs';
  return 'Northern Suburbs';
}

/**
 * Aggregate all metrics into a summary.
 */
export function aggregateMetrics(
  results: CellResult[],
  evaluation: EvaluationOutput,
  totalCells: number,
  landCells: number
): MetricsSummary {
  const { pointwiseScores, consistencyResults, positionBiasResults, pairwiseComparisons } =
    evaluation;

  const dimMeans = calc.perDimensionMeans(pointwiseScores);

  // Per-region breakdown
  const regionGroups = new Map<string, { scores: number[]; count: number }>();
  const scoreMap = new Map(pointwiseScores.map((s) => [s.cellId, s]));

  for (const result of results) {
    const region = classifyRegion(result.center.lat);
    if (!regionGroups.has(region)) {
      regionGroups.set(region, { scores: [], count: 0 });
    }
    const group = regionGroups.get(region)!;
    group.count++;

    const score = scoreMap.get(result.cellId);
    if (score) {
      group.scores.push(score.overall_score);
    }
  }

  const perRegionBreakdown: Record<string, { cellCount: number; avgScore: number }> = {};
  for (const [region, group] of regionGroups) {
    perRegionBreakdown[region] = {
      cellCount: group.count,
      avgScore:
        group.scores.length > 0
          ? group.scores.reduce((a, b) => a + b, 0) / group.scores.length
          : 0,
    };
  }

  return {
    totalCells,
    landCells,
    processedCells: results.length,
    vacancyDetectionRate: calc.vacancyDetectionRate(results),
    avgSuitability: calc.avgSuitability(results),
    avgConfidence: calc.avgConfidence(results),
    perDimensionMeans: dimMeans,
    overallQualityScore: calc.overallQualityScore(dimMeans),
    repetitionConsistency: calc.repetitionConsistency(consistencyResults),
    positionBiasRate: calc.positionBiasRate(positionBiasResults),
    cohensKappa: calc.cohensKappa(consistencyResults),
    spatialCoherence: calc.spatialCoherence(pairwiseComparisons),
    perTypeFrequency: calc.perTypeFrequency(results),
    perRegionBreakdown,
  };
}
