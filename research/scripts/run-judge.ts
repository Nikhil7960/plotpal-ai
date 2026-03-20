/**
 * Step 4: Run LLM-as-a-Judge evaluation on all results.
 */
import fs from 'fs';
import { PATHS } from '../config.js';
import { GridCell } from '../types.js';
import { runEvaluation } from '../evaluation/judge.js';

async function main() {
  console.log('=== Step 4: LLM-as-a-Judge Evaluation ===\n');

  if (!fs.existsSync(PATHS.grid)) {
    console.error('Grid not found. Run "npm run grid" first.');
    process.exit(1);
  }

  const cells: GridCell[] = JSON.parse(fs.readFileSync(PATHS.grid, 'utf-8'));

  const startTime = Date.now();
  const evaluation = await runEvaluation(cells);
  const elapsed = (Date.now() - startTime) / 1000;

  console.log(`\nEvaluation completed in ${(elapsed / 60).toFixed(1)} minutes`);
  console.log(`  Pointwise scores: ${evaluation.pointwiseScores.length}`);
  console.log(`  Consistency checks: ${evaluation.consistencyResults.length}`);
  console.log(`  Position bias tests: ${evaluation.positionBiasResults.length}`);
  console.log(`  Pairwise comparisons: ${evaluation.pairwiseComparisons.length}`);
}

main().catch(console.error);
