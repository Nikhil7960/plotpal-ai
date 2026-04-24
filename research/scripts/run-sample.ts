/**
 * Step 2: Test 5 diverse cells end-to-end before scaling.
 */
import fs from 'fs';
import { PATHS } from '../config.js';
import { GridCell } from '../types.js';
import { processCell } from '../pipeline/runner.js';
import { scoreResult } from '../evaluation/pointwise-scorer.js';
import { RateLimiter } from '../pipeline/rate-limiter.js';

// 5 diverse test locations in Mumbai
const SAMPLE_LOCATIONS = [
  { name: 'South Mumbai (dense urban)', lat: 18.94, lng: 72.83 },
  { name: 'Andheri (suburban)', lat: 19.12, lng: 72.85 },
  { name: 'Mahul (industrial)', lat: 19.02, lng: 72.90 },
  { name: 'Juhu (coastal)', lat: 19.10, lng: 72.83 },
  { name: 'Aarey (green area)', lat: 19.16, lng: 72.87 },
];

async function main() {
  console.log('=== Step 2: Sample Run (5 cells) ===\n');

  // Load grid
  if (!fs.existsSync(PATHS.grid)) {
    console.error('Grid not found. Run "npm run grid" first.');
    process.exit(1);
  }
  const cells: GridCell[] = JSON.parse(fs.readFileSync(PATHS.grid, 'utf-8'));
  const landCells = cells.filter((c) => c.isLand);

  // Find closest land cell to each sample location
  const sampleCells: GridCell[] = [];
  for (const loc of SAMPLE_LOCATIONS) {
    let closest: GridCell | null = null;
    let minDist = Infinity;

    for (const cell of landCells) {
      const dist =
        Math.pow(cell.center.lat - loc.lat, 2) +
        Math.pow(cell.center.lng - loc.lng, 2);
      if (dist < minDist) {
        minDist = dist;
        closest = cell;
      }
    }

    if (closest) {
      sampleCells.push(closest);
      console.log(
        `${loc.name}: using ${closest.id} (${closest.center.lat.toFixed(4)}, ${closest.center.lng.toFixed(4)})`
      );
    }
  }

  console.log(`\nProcessing ${sampleCells.length} sample cells...\n`);

  const rateLimiter = new RateLimiter(30); // Conservative for testing

  for (const cell of sampleCells) {
    try {
      console.log(`--- Processing ${cell.id} ---`);

      // Run pipeline (now returns multiple results, one per building type)
      const results = await processCell(cell, rateLimiter);
      console.log(`  Building types tested: ${results.length}`);

      for (const result of results) {
        console.log(
          `  [${result.buildingType}] spaces=${result.filteredResult.vacantSpaces.length} ` +
            `confidence=${result.filteredResult.confidence} duration=${result.durationMs}ms`
        );

        // Validate
        for (const space of result.filteredResult.vacantSpaces) {
          const inBounds =
            space.coordinates.lat >= cell.bounds.latMin &&
            space.coordinates.lat <= cell.bounds.latMax &&
            space.coordinates.lng >= cell.bounds.lngMin &&
            space.coordinates.lng <= cell.bounds.lngMax;
          console.log(`     • ${space.location} | In bounds: ${inBounds}`);
        }

        // Run judge for the first result only
        if (result === results[0]) {
          await rateLimiter.acquire();
          const score = await scoreResult(result);
          console.log(
            `     Judge: R=${score.relevance.score} F=${score.feasibility.score} ` +
              `RQ=${score.reasoning_quality.score} GA=${score.geographic_accuracy.score} ` +
              `C=${score.completeness.score} Overall=${score.overall_score}`
          );
        }
      }

      const imageExists = results.length > 0 && fs.existsSync(results[0].imageFile);
      console.log(`  Image saved: ${imageExists}`);

      console.log('');
    } catch (error) {
      console.error(`  ERROR: ${error}`);
      console.log('');
    }
  }

  console.log('Sample run complete!');
}

main().catch(console.error);
