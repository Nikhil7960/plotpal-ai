import { GridCell, CellResult, ConsistencyResult } from '../types.js';
import { processCell } from '../pipeline/runner.js';

/**
 * Re-run pipeline on a cell and compare with original for consistency.
 */
export async function checkConsistency(
  cell: GridCell,
  originalResult: CellResult
): Promise<ConsistencyResult> {
  // Force re-run by calling processCell directly (bypasses checkpoint)
  const { analyzeCell, filterResult } = await import('../pipeline/gemini-client.js');
  const { stitchCellImage } = await import('../imagery/tile-stitcher.js');

  const imageBase64 = await stitchCellImage(cell);
  const rerunPipeline = await analyzeCell(imageBase64, cell.center);
  const rerunFiltered = await filterResult(rerunPipeline, cell.center);

  // Compare: count overlapping spaces by proximity (within ~100m)
  const origSpaces = originalResult.filteredResult.vacantSpaces;
  const rerunSpaces = rerunFiltered.vacantSpaces;

  let overlapCount = 0;
  const PROXIMITY_THRESHOLD = 0.001; // ~100m in degrees

  for (const orig of origSpaces) {
    for (const rerun of rerunSpaces) {
      const latDiff = Math.abs(orig.coordinates.lat - rerun.coordinates.lat);
      const lngDiff = Math.abs(orig.coordinates.lng - rerun.coordinates.lng);
      if (latDiff < PROXIMITY_THRESHOLD && lngDiff < PROXIMITY_THRESHOLD) {
        overlapCount++;
        break;
      }
    }
  }

  const maxSpaces = Math.max(origSpaces.length, rerunSpaces.length, 1);
  const repetitionConsistency = overlapCount / maxSpaces;

  return {
    cellId: cell.id,
    originalSpaces: origSpaces.length,
    rerunSpaces: rerunSpaces.length,
    overlapCount,
    repetitionConsistency,
  };
}
