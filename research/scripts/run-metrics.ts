/**
 * Step 5: Compute metrics and export JSON/CSV/LaTeX.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../config.js';
import { GridCell, CellResult } from '../types.js';
import { EvaluationOutput } from '../evaluation/judge.js';
import { aggregateMetrics } from '../metrics/aggregator.js';
import { exportJSON, exportCSV, exportLaTeX } from '../metrics/exporter.js';

async function main() {
  console.log('=== Step 5: Metrics & Export ===\n');

  // Load grid
  if (!fs.existsSync(PATHS.grid)) {
    console.error('Grid not found. Run "npm run grid" first.');
    process.exit(1);
  }
  const cells: GridCell[] = JSON.parse(fs.readFileSync(PATHS.grid, 'utf-8'));
  const totalCells = cells.length;
  const landCells = cells.filter((c) => c.isLand).length;

  // Load results
  const resultsDir = PATHS.results;
  if (!fs.existsSync(resultsDir)) {
    console.error('No results found. Run pipeline first.');
    process.exit(1);
  }
  const results: CellResult[] = fs
    .readdirSync(resultsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf-8')));
  console.log(`Loaded ${results.length} results`);

  // Load evaluation
  const evalPath = path.join(PATHS.evaluation, 'full-evaluation.json');
  if (!fs.existsSync(evalPath)) {
    console.error('No evaluation found. Run "npm run judge" first.');
    process.exit(1);
  }
  const evaluation: EvaluationOutput = JSON.parse(
    fs.readFileSync(evalPath, 'utf-8')
  );
  console.log(`Loaded evaluation data`);

  // Compute metrics
  const summary = aggregateMetrics(results, evaluation, totalCells, landCells);

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Total cells: ${summary.totalCells}`);
  console.log(`Land cells: ${summary.landCells}`);
  console.log(`Processed cells: ${summary.processedCells}`);
  console.log(`Vacancy detection rate: ${(summary.vacancyDetectionRate * 100).toFixed(1)}%`);
  console.log(`Avg suitability: ${summary.avgSuitability.toFixed(1)}`);
  console.log(`Avg confidence: ${summary.avgConfidence.toFixed(1)}`);
  console.log(`Overall quality score: ${summary.overallQualityScore.toFixed(2)}`);
  console.log(`Repetition consistency: ${summary.repetitionConsistency.toFixed(3)}`);
  console.log(`Position bias rate: ${(summary.positionBiasRate * 100).toFixed(1)}%`);
  console.log(`Cohen's kappa: ${summary.cohensKappa.toFixed(3)}`);
  console.log(`Spatial coherence: ${summary.spatialCoherence.toFixed(3)}`);

  console.log('\nPer-dimension means:');
  for (const [dim, score] of Object.entries(summary.perDimensionMeans)) {
    console.log(`  ${dim}: ${score.toFixed(2)}`);
  }

  console.log('\nPer-type frequency:');
  for (const [type, count] of Object.entries(summary.perTypeFrequency).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${type}: ${count}`);
  }

  console.log('\nPer-region breakdown:');
  for (const [region, data] of Object.entries(summary.perRegionBreakdown)) {
    console.log(`  ${region}: ${data.cellCount} cells, avg score ${data.avgScore.toFixed(2)}`);
  }

  // Export
  console.log('\n=== Exporting ===');
  exportJSON(summary, results);
  exportCSV(results);
  exportLaTeX(summary);

  console.log('\nDone!');
}

main().catch(console.error);
