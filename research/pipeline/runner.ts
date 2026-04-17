import fs from 'fs';
import path from 'path';
import { PATHS, RATE_LIMIT, CONCURRENCY, BUILDING_TYPES, BuildingType } from '../config.js';
import { GridCell, CellResult, LocationContextSnapshot } from '../types.js';
import { stitchCellImage } from '../imagery/tile-stitcher.js';
import { analyzeCell, filterResult } from './gemini-client.js';
import { fetchLocationContext, rateLimitDelay } from './location-context.js';
import { RateLimiter } from './rate-limiter.js';
import { isCellComplete, markCellComplete } from './checkpoint.js';
import { withRetry } from './retry.js';

/**
 * For each cell we now generate training data across multiple building types
 * because production calls the model with a specific building type per request.
 * Sampling 3 random types per cell keeps the dataset diverse without 11x cost.
 */
const TYPES_PER_CELL = 3;

function pickRandomTypes(n: number): BuildingType[] {
  const shuffled = [...BUILDING_TYPES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function snapshotContext(ctx: Awaited<ReturnType<typeof fetchLocationContext>>): LocationContextSnapshot {
  return {
    address: ctx.address,
    summary: ctx.summary,
    waterBodyCount: ctx.waterBodies.length,
    forestCount: ctx.forests.length,
    buildingCount: ctx.buildingCount,
  };
}

/**
 * Process a single (cell, buildingType) pair: image → analyze → filter → save.
 */
async function processCellWithType(
  cell: GridCell,
  buildingType: BuildingType,
  imageBase64: string,
  locationContext: Awaited<ReturnType<typeof fetchLocationContext>>,
  rateLimiter: RateLimiter
): Promise<CellResult> {
  return withRetry(
    async () => {
      const startTime = Date.now();

      await rateLimiter.acquire();
      const pipelineResult = await analyzeCell(imageBase64, buildingType, cell.center, locationContext);

      await rateLimiter.acquire();
      const filteredResult = await filterResult(pipelineResult, buildingType, cell.center, locationContext);

      const result: CellResult = {
        cellId: cell.id,
        center: cell.center,
        imageFile: path.join(PATHS.images, `${cell.id}.png`),
        buildingType,
        locationContext: snapshotContext(locationContext),
        pipelineResult,
        filteredResult,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      fs.mkdirSync(PATHS.results, { recursive: true });
      const outFile = path.join(PATHS.results, `${cell.id}__${buildingType}.json`);
      fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

      return result;
    },
    `cell(${cell.id},${buildingType})`,
    { maxRetries: 2, baseDelayMs: 5000, maxDelayMs: 30000 }
  );
}

/**
 * Process a single cell across multiple building types.
 * Image fetch + location context fetch happen ONCE per cell, then we iterate
 * building types reusing the same image and context.
 */
export async function processCell(
  cell: GridCell,
  rateLimiter: RateLimiter,
  options: { typesPerCell?: number } = {}
): Promise<CellResult[]> {
  const typesPerCell = options.typesPerCell ?? TYPES_PER_CELL;

  // 1. Get satellite image once
  const imageBase64 = await stitchCellImage(cell);

  // 2. Fetch location context once
  const locationContext = await fetchLocationContext(cell.center.lat, cell.center.lng, 800);

  // 3. Pick a random subset of building types
  const types = pickRandomTypes(typesPerCell);

  // 4. Process each building type sequentially (avoid hammering Gemini for one cell)
  const results: CellResult[] = [];
  for (const buildingType of types) {
    try {
      const result = await processCellWithType(cell, buildingType, imageBase64, locationContext, rateLimiter);
      results.push(result);
      // Small polite delay between types within the same cell
      await rateLimitDelay(500);
    } catch (e) {
      console.error(
        `  cell ${cell.id} type=${buildingType} failed: ${e instanceof Error ? e.message : e}`
      );
    }
  }

  // Mark cell complete only if at least one type succeeded
  if (results.length > 0) {
    markCellComplete(cell.id);
  }

  return results;
}

export interface RunOptions {
  /** Max cells processed concurrently. Default from config. */
  concurrency?: number;
  /** API requests per minute. Default from config. */
  rpm?: number;
  /** How many random building types to sample per cell. Default 3. */
  typesPerCell?: number;
  /** Progress callback */
  onProgress?: (completed: number, total: number, elapsed: number) => void;
}

interface FailedCell {
  cellId: string;
  error: string;
  timestamp: string;
}

/**
 * Run the pipeline across cells with parallel processing and checkpointing.
 * Failed cells are logged but don't stop the pipeline.
 */
export async function runPipeline(
  cells: GridCell[],
  options: RunOptions = {}
): Promise<CellResult[]> {
  const concurrency = options.concurrency ?? CONCURRENCY;
  const rpm = options.rpm ?? RATE_LIMIT.requestsPerMinute;
  const typesPerCell = options.typesPerCell ?? TYPES_PER_CELL;
  const rateLimiter = new RateLimiter(rpm);

  const pending = cells.filter((c) => c.isLand && !isCellComplete(c.id));
  const alreadyDone = cells.filter((c) => c.isLand && isCellComplete(c.id));

  // Load existing results for completed cells (now there can be multiple per cell)
  const existingResults: CellResult[] = [];
  for (const cell of alreadyDone) {
    for (const buildingType of BUILDING_TYPES) {
      const resultPath = path.join(PATHS.results, `${cell.id}__${buildingType}.json`);
      if (fs.existsSync(resultPath)) {
        existingResults.push(JSON.parse(fs.readFileSync(resultPath, 'utf-8')));
      }
    }
  }

  const totalLand = pending.length + alreadyDone.length;
  let completed = alreadyDone.length;
  let succeeded = 0;
  const failedCells: FailedCell[] = [];
  const startTime = Date.now();

  console.log(
    `Total: ${totalLand} land cells | Already done: ${alreadyDone.length} | Pending: ${pending.length}`
  );
  console.log(`Concurrency: ${concurrency} | Rate limit: ${rpm} RPM | Types per cell: ${typesPerCell}`);
  console.log(`Building types pool: ${BUILDING_TYPES.join(', ')}\n`);

  if (pending.length === 0) {
    console.log('All cells already processed!');
    return existingResults;
  }

  const allResults: CellResult[] = [...existingResults];

  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);

    const promises = batch.map(async (cell): Promise<CellResult[] | null> => {
      try {
        const results = await processCell(cell, rateLimiter, { typesPerCell });
        succeeded++;
        completed++;

        const elapsed = (Date.now() - startTime) / 1000;
        const processedSoFar = completed - alreadyDone.length;
        const rate = processedSoFar / elapsed;
        const remaining = rate > 0 ? (pending.length - processedSoFar) / rate : 0;

        const totalSpaces = results.reduce((s, r) => s + r.filteredResult.vacantSpaces.length, 0);
        console.log(
          `[${completed}/${totalLand}] ${cell.id} — ${results.length} types, ${totalSpaces} spaces ` +
            `| ETA: ${(remaining / 60).toFixed(1)}min`
        );

        options.onProgress?.(completed, totalLand, elapsed);
        return results;
      } catch (error) {
        completed++;
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[${completed}/${totalLand}] ${cell.id} — FAILED: ${errMsg}`);
        failedCells.push({ cellId: cell.id, error: errMsg, timestamp: new Date().toISOString() });
        return null;
      }
    });

    const batchResults = await Promise.allSettled(promises);
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        allResults.push(...r.value);
      }
    }
  }

  if (failedCells.length > 0) {
    fs.mkdirSync(PATHS.checkpoints, { recursive: true });
    const failPath = path.join(PATHS.checkpoints, 'failed-cells.json');
    fs.writeFileSync(failPath, JSON.stringify(failedCells, null, 2));
    console.log(`\nFailed cells logged to ${failPath}`);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n' + '='.repeat(50));
  console.log('PIPELINE SUMMARY');
  console.log('='.repeat(50));
  console.log(`Duration:    ${(elapsed / 60).toFixed(1)} minutes`);
  console.log(`Succeeded:   ${succeeded}/${pending.length} new cells`);
  console.log(`Failed:      ${failedCells.length}/${pending.length}`);
  console.log(`Total rows:  ${allResults.length} (cell × buildingType pairs)`);

  return allResults;
}
