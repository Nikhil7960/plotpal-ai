import fs from 'fs';
import path from 'path';
import { PATHS, RATE_LIMIT, CONCURRENCY } from '../config.js';
import { GridCell, CellResult } from '../types.js';
import { stitchCellImage } from '../imagery/tile-stitcher.js';
import { analyzeCell, filterResult } from './gemini-client.js';
import { RateLimiter } from './rate-limiter.js';
import { isCellComplete, markCellComplete } from './checkpoint.js';
import { withRetry, isRetryable } from './retry.js';

/**
 * Process a single cell: fetch image → analyze → filter → save.
 * Each sub-step already has its own retry logic. This wraps the whole
 * cell in one more retry for transient issues between steps.
 */
export async function processCell(
  cell: GridCell,
  rateLimiter: RateLimiter
): Promise<CellResult> {
  return withRetry(
    async () => {
      const startTime = Date.now();

      // 1. Get satellite image (tile-fetcher has its own retry)
      const imageBase64 = await stitchCellImage(cell);

      // 2. Vision analysis (gemini-client has its own retry)
      await rateLimiter.acquire();
      const pipelineResult = await analyzeCell(imageBase64, cell.center);

      // 3. Filter (gemini-client has its own retry + fallback)
      await rateLimiter.acquire();
      const filteredResult = await filterResult(pipelineResult, cell.center);

      const result: CellResult = {
        cellId: cell.id,
        center: cell.center,
        imageFile: path.join(PATHS.images, `${cell.id}.png`),
        pipelineResult,
        filteredResult,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      // 4. Save result
      fs.mkdirSync(PATHS.results, { recursive: true });
      fs.writeFileSync(
        path.join(PATHS.results, `${cell.id}.json`),
        JSON.stringify(result, null, 2)
      );

      // 5. Update checkpoint
      markCellComplete(cell.id);

      return result;
    },
    `cell(${cell.id})`,
    { maxRetries: 2, baseDelayMs: 5000, maxDelayMs: 30000 }
  );
}

export interface RunOptions {
  /** Max cells processed concurrently. Default from config. */
  concurrency?: number;
  /** API requests per minute. Default from config. */
  rpm?: number;
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
  const rateLimiter = new RateLimiter(rpm);

  // Filter to land cells not yet completed
  const pending = cells.filter((c) => c.isLand && !isCellComplete(c.id));
  const alreadyDone = cells.filter((c) => c.isLand && isCellComplete(c.id));

  // Load existing results for completed cells
  const existingResults: CellResult[] = [];
  for (const cell of alreadyDone) {
    const resultPath = path.join(PATHS.results, `${cell.id}.json`);
    if (fs.existsSync(resultPath)) {
      existingResults.push(JSON.parse(fs.readFileSync(resultPath, 'utf-8')));
    }
  }

  const totalLand = pending.length + alreadyDone.length;
  let completed = alreadyDone.length;
  let succeeded = 0;
  const failedCells: FailedCell[] = [];
  const startTime = Date.now();

  console.log(`Total: ${totalLand} land cells | Already done: ${alreadyDone.length} | Pending: ${pending.length}`);
  console.log(`Concurrency: ${concurrency} | Rate limit: ${rpm} RPM`);
  console.log(`Retry: 3 attempts per API call + 2 retries per cell\n`);

  if (pending.length === 0) {
    console.log('All cells already processed!');
    return existingResults;
  }

  const allResults: CellResult[] = [...existingResults];

  // Process in concurrent batches
  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);

    const promises = batch.map(async (cell): Promise<CellResult | null> => {
      try {
        const result = await processCell(cell, rateLimiter);
        succeeded++;
        completed++;

        const elapsed = (Date.now() - startTime) / 1000;
        const processedSoFar = completed - alreadyDone.length;
        const rate = processedSoFar / elapsed;
        const remaining = rate > 0 ? (pending.length - processedSoFar) / rate : 0;

        console.log(
          `[${completed}/${totalLand}] ${cell.id} — ${result.filteredResult.vacantSpaces.length} spaces ` +
          `(${(result.durationMs / 1000).toFixed(1)}s) | ETA: ${(remaining / 60).toFixed(1)}min`
        );

        options.onProgress?.(completed, totalLand, elapsed);
        return result;
      } catch (error) {
        completed++;
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[${completed}/${totalLand}] ${cell.id} — FAILED after all retries: ${errMsg}`);
        failedCells.push({
          cellId: cell.id,
          error: errMsg,
          timestamp: new Date().toISOString(),
        });
        return null;
      }
    });

    const batchResults = await Promise.allSettled(promises);
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        allResults.push(r.value);
      }
    }
  }

  // Write failure log
  if (failedCells.length > 0) {
    fs.mkdirSync(PATHS.checkpoints, { recursive: true });
    const failPath = path.join(PATHS.checkpoints, 'failed-cells.json');
    fs.writeFileSync(failPath, JSON.stringify(failedCells, null, 2));
    console.log(`\nFailed cells logged to ${failPath}`);
  }

  // Print summary
  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n' + '='.repeat(50));
  console.log('PIPELINE SUMMARY');
  console.log('='.repeat(50));
  console.log(`Duration:    ${(elapsed / 60).toFixed(1)} minutes`);
  console.log(`Succeeded:   ${succeeded}/${pending.length} new cells`);
  console.log(`Failed:      ${failedCells.length}/${pending.length}`);
  console.log(`Total done:  ${allResults.length}/${totalLand} land cells`);
  if (failedCells.length > 0) {
    console.log(`\nFailed cells (re-run pipeline to retry):`);
    for (const f of failedCells) {
      console.log(`  ${f.cellId}: ${f.error}`);
    }
  }

  return allResults;
}
