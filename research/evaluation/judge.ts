import fs from 'fs';
import path from 'path';
import { PATHS, EVAL_CONFIG, RATE_LIMIT, CONCURRENCY } from '../config.js';
import { GridCell, CellResult, PointwiseScore, PairwiseComparison, ConsistencyResult, PositionBiasResult } from '../types.js';
import { scoreResult } from './pointwise-scorer.js';
import { comparePair, findAdjacentPairs } from './pairwise-comparator.js';
import { checkConsistency } from './consistency-checker.js';
import { testPositionBias } from './position-bias-tester.js';
import { RateLimiter } from '../pipeline/rate-limiter.js';

export interface EvaluationOutput {
  pointwiseScores: PointwiseScore[];
  pairwiseComparisons: PairwiseComparison[];
  consistencyResults: ConsistencyResult[];
  positionBiasResults: PositionBiasResult[];
}

/**
 * Load all cell results from disk.
 */
function loadAllResults(): CellResult[] {
  const resultsDir = PATHS.results;
  if (!fs.existsSync(resultsDir)) return [];

  return fs.readdirSync(resultsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf-8')));
}

/**
 * Process items in parallel batches with rate limiting.
 */
async function parallelBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  rateLimiter: RateLimiter,
  concurrency: number,
  label: string,
  onProgress: (i: number, total: number, result: R | null) => void
): Promise<R[]> {
  const results: R[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    const promises = batch.map(async (item) => {
      await rateLimiter.acquire();
      try {
        const result = await fn(item);
        completed++;
        onProgress(completed, items.length, result);
        return result;
      } catch (error) {
        completed++;
        console.error(`[${completed}/${items.length}] ${label} — FAILED: ${error instanceof Error ? error.message : error}`);
        onProgress(completed, items.length, null);
        return null;
      }
    });

    const batchResults = await Promise.allSettled(promises);
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value !== null) {
        results.push(r.value);
      }
    }
  }

  return results;
}

/**
 * Load existing evaluation checkpoint if available.
 */
function loadExistingScores(): PointwiseScore[] {
  const scorePath = path.join(PATHS.evaluation, 'pointwise-scores.json');
  if (fs.existsSync(scorePath)) {
    return JSON.parse(fs.readFileSync(scorePath, 'utf-8'));
  }
  return [];
}

/**
 * Run all evaluation stages with parallel processing.
 */
export async function runEvaluation(
  cells: GridCell[]
): Promise<EvaluationOutput> {
  const results = loadAllResults();
  const concurrency = CONCURRENCY;
  const rateLimiter = new RateLimiter(RATE_LIMIT.requestsPerMinute);

  console.log(`Loaded ${results.length} cell results for evaluation`);
  console.log(`Concurrency: ${concurrency} | Rate limit: ${RATE_LIMIT.requestsPerMinute} RPM\n`);

  fs.mkdirSync(PATHS.evaluation, { recursive: true });

  // 1. Pointwise scoring (all results) — with checkpoint resume
  console.log('=== Pointwise Scoring ===');
  const existingScores = loadExistingScores();
  const scoredCellIds = new Set(existingScores.map((s) => s.cellId));
  const unscoredResults = results.filter((r) => !scoredCellIds.has(r.cellId));

  console.log(`Already scored: ${existingScores.length} | Remaining: ${unscoredResults.length}`);

  const newScores = await parallelBatch(
    unscoredResults,
    (result) => scoreResult(result),
    rateLimiter,
    concurrency,
    'pointwise',
    (i, total, result) => {
      if (result) {
        console.log(`[${existingScores.length + i}/${results.length}] ${result.cellId}: overall=${result.overall_score}`);
      }
    }
  );

  const pointwiseScores = [...existingScores, ...newScores];

  // Save checkpoint after pointwise (biggest stage)
  fs.writeFileSync(
    path.join(PATHS.evaluation, 'pointwise-scores.json'),
    JSON.stringify(pointwiseScores, null, 2)
  );
  console.log(`Pointwise complete: ${pointwiseScores.length} scores saved\n`);

  // 2. Consistency check (sample) — re-runs pipeline, uses 2 API calls each
  console.log('=== Consistency Check ===');
  const cellMap = new Map(cells.map((c) => [c.id, c]));
  const consistencySample = results
    .sort(() => Math.random() - 0.5)
    .slice(0, EVAL_CONFIG.consistencySampleSize);

  const consistencyResults = await parallelBatch(
    consistencySample,
    async (result) => {
      const cell = cellMap.get(result.cellId);
      if (!cell) throw new Error(`Cell not found: ${result.cellId}`);
      await rateLimiter.acquire(); // extra token for 2nd API call
      return checkConsistency(cell, result);
    },
    rateLimiter,
    Math.min(concurrency, 5), // Lower concurrency — 2 API calls each
    'consistency',
    (i, total, result) => {
      if (result) {
        console.log(`[${i}/${total}] ${result.cellId}: RC=${result.repetitionConsistency.toFixed(2)}`);
      }
    }
  );

  fs.writeFileSync(
    path.join(PATHS.evaluation, 'consistency-results.json'),
    JSON.stringify(consistencyResults, null, 2)
  );
  console.log(`Consistency complete: ${consistencyResults.length} results\n`);

  // 3. Position bias test (sample)
  console.log('=== Position Bias Test ===');
  const scoreMap = new Map(pointwiseScores.map((s) => [s.cellId, s]));
  const biasSample = results
    .filter((r) => scoreMap.has(r.cellId))
    .sort(() => Math.random() - 0.5)
    .slice(0, EVAL_CONFIG.positionBiasSampleSize);

  const positionBiasResults = await parallelBatch(
    biasSample,
    (result) => testPositionBias(result, scoreMap.get(result.cellId)!),
    rateLimiter,
    concurrency,
    'bias',
    (i, total, result) => {
      if (result) {
        console.log(`[${i}/${total}] ${result.cellId}: maxDiff=${result.maxDiff}, biased=${result.biased}`);
      }
    }
  );

  fs.writeFileSync(
    path.join(PATHS.evaluation, 'position-bias-results.json'),
    JSON.stringify(positionBiasResults, null, 2)
  );
  console.log(`Bias test complete: ${positionBiasResults.length} results\n`);

  // 4. Pairwise comparison (adjacent cells)
  console.log('=== Pairwise Comparison ===');
  const pairs = findAdjacentPairs(results, EVAL_CONFIG.pairwiseComparisonSize);

  const pairwiseComparisons = await parallelBatch(
    pairs,
    ([a, b]) => comparePair(a, b),
    rateLimiter,
    concurrency,
    'pairwise',
    (i, total, result) => {
      if (result) {
        console.log(`[${i}/${total}] ${result.cellA} vs ${result.cellB}: coherence=${result.spatialCoherence.toFixed(2)}`);
      }
    }
  );

  fs.writeFileSync(
    path.join(PATHS.evaluation, 'pairwise-comparisons.json'),
    JSON.stringify(pairwiseComparisons, null, 2)
  );
  console.log(`Pairwise complete: ${pairwiseComparisons.length} results\n`);

  // Save full evaluation
  const output: EvaluationOutput = {
    pointwiseScores,
    pairwiseComparisons,
    consistencyResults,
    positionBiasResults,
  };

  fs.writeFileSync(
    path.join(PATHS.evaluation, 'full-evaluation.json'),
    JSON.stringify(output, null, 2)
  );

  // Summary
  console.log('='.repeat(50));
  console.log('EVALUATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Pointwise scores:     ${pointwiseScores.length}`);
  console.log(`Consistency checks:   ${consistencyResults.length}`);
  console.log(`Position bias tests:  ${positionBiasResults.length}`);
  console.log(`Pairwise comparisons: ${pairwiseComparisons.length}`);
  const avgOverall = pointwiseScores.reduce((a, s) => a + s.overall_score, 0) / pointwiseScores.length;
  console.log(`Avg overall score:    ${avgOverall.toFixed(2)}`);
  const biasRate = positionBiasResults.filter((r) => r.biased).length / positionBiasResults.length;
  console.log(`Position bias rate:   ${(biasRate * 100).toFixed(1)}%`);

  return output;
}
