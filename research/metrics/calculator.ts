import { RUBRIC_DIMENSIONS } from '../evaluation/rubrics.js';
import {
  PointwiseScore,
  ConsistencyResult,
  PositionBiasResult,
  PairwiseComparison,
  CellResult,
} from '../types.js';

/**
 * Compute per-dimension means from pointwise scores.
 */
export function perDimensionMeans(
  scores: PointwiseScore[]
): Record<string, number> {
  const means: Record<string, number> = {};
  for (const dim of RUBRIC_DIMENSIONS) {
    const values = scores.map((s) => s[dim].score);
    means[dim] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  return means;
}

/**
 * Overall quality score — weighted average of dimensions.
 */
export function overallQualityScore(
  dimMeans: Record<string, number>
): number {
  const weights: Record<string, number> = {
    relevance: 0.25,
    feasibility: 0.25,
    reasoning_quality: 0.2,
    geographic_accuracy: 0.15,
    completeness: 0.15,
  };

  let total = 0;
  let weightSum = 0;
  for (const [dim, weight] of Object.entries(weights)) {
    if (dimMeans[dim] !== undefined) {
      total += dimMeans[dim] * weight;
      weightSum += weight;
    }
  }
  return weightSum > 0 ? total / weightSum : 0;
}

/**
 * Repetition Consistency — average RC across consistency checks.
 */
export function repetitionConsistency(
  results: ConsistencyResult[]
): number {
  if (results.length === 0) return 0;
  return results.reduce((a, b) => a + b.repetitionConsistency, 0) / results.length;
}

/**
 * Position bias rate — fraction of tests showing bias (maxDiff > 1).
 */
export function positionBiasRate(results: PositionBiasResult[]): number {
  if (results.length === 0) return 0;
  return results.filter((r) => r.biased).length / results.length;
}

/**
 * Cohen's Kappa for inter-run agreement on vacancy detection.
 * Simplified: treats each space as a binary detection (found/not found) at each location.
 */
export function cohensKappa(results: ConsistencyResult[]): number {
  if (results.length === 0) return 0;

  // Compute agreement: both found similar count, or both found nothing
  let agree = 0;
  let total = results.length;

  for (const r of results) {
    // Agreement if overlap is high relative to max
    const maxSpaces = Math.max(r.originalSpaces, r.rerunSpaces, 1);
    if (r.overlapCount / maxSpaces >= 0.5) {
      agree++;
    }
  }

  const po = agree / total; // observed agreement
  // Expected agreement by chance (assume 50/50 for simplicity)
  const pe = 0.5;
  const kappa = (po - pe) / (1 - pe);

  return Math.max(0, Math.min(1, kappa));
}

/**
 * Average spatial coherence from pairwise comparisons.
 */
export function spatialCoherence(
  comparisons: PairwiseComparison[]
): number {
  if (comparisons.length === 0) return 0;
  return comparisons.reduce((a, b) => a + b.spatialCoherence, 0) / comparisons.length;
}

/**
 * Vacancy detection rate — fraction of cells where ≥1 space found.
 */
export function vacancyDetectionRate(results: CellResult[]): number {
  if (results.length === 0) return 0;
  const detected = results.filter(
    (r) => r.filteredResult.vacantSpaces.length > 0
  ).length;
  return detected / results.length;
}

/**
 * Per infrastructure type frequency — how often each type is recommended.
 */
export function perTypeFrequency(
  results: CellResult[]
): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const r of results) {
    for (const space of r.filteredResult.vacantSpaces) {
      for (const type of space.recommendedTypes || []) {
        freq[type] = (freq[type] || 0) + 1;
      }
    }
  }
  return freq;
}

/**
 * Average suitability score across all spaces.
 */
export function avgSuitability(results: CellResult[]): number {
  const scores: number[] = [];
  for (const r of results) {
    for (const space of r.filteredResult.vacantSpaces) {
      scores.push(space.suitability);
    }
  }
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Average confidence across cells.
 */
export function avgConfidence(results: CellResult[]): number {
  if (results.length === 0) return 0;
  return results.reduce((a, b) => a + b.filteredResult.confidence, 0) / results.length;
}
