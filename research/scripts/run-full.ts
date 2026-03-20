/**
 * Step 3: Run pipeline on shortlisted urban cells with parallel processing.
 *
 * Uses shortlisted.json if available, otherwise falls back to full grid.
 */
import fs from 'fs';
import path from 'path';
import { PATHS, OUTPUT_DIR } from '../config.js';
import { GridCell } from '../types.js';
import { runPipeline } from '../pipeline/runner.js';

async function main() {
  console.log('=== Step 3: Full Pipeline Run (Parallel) ===\n');

  const shortlistedPath = path.join(OUTPUT_DIR, 'shortlisted.json');
  let cells: GridCell[];

  if (fs.existsSync(shortlistedPath)) {
    cells = JSON.parse(fs.readFileSync(shortlistedPath, 'utf-8'));
    console.log(`Using shortlisted cells: ${cells.length}`);
  } else if (fs.existsSync(PATHS.grid)) {
    cells = JSON.parse(fs.readFileSync(PATHS.grid, 'utf-8'));
    const landCount = cells.filter((c) => c.isLand).length;
    console.log(`No shortlist found — using full grid (${landCount} land cells)`);
    console.log(`Tip: Run "npm run shortlist" first to focus on ~500 urban cells.\n`);
  } else {
    console.error('No grid found. Run "npm run grid" first.');
    process.exit(1);
  }

  const concurrency = parseInt(process.env.CONCURRENCY || '10', 10);
  const rpm = parseInt(process.env.RPM || '60', 10);

  const startTime = Date.now();

  const results = await runPipeline(cells, { concurrency, rpm });

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\nCompleted ${results.length} cells in ${(elapsed / 60).toFixed(1)} minutes`);

  const withSpaces = results.filter(
    (r) => r.filteredResult.vacantSpaces.length > 0
  ).length;
  console.log(`Cells with vacant spaces: ${withSpaces}/${results.length}`);
}

main().catch(console.error);
