import { GridCell, CellResult, ConsistencyResult } from '../types.js';

/**
 * Re-run pipeline on a cell and compare with original for consistency.
 * Uses the same building type as the original result to make a fair comparison.
 */
export async function checkConsistency(
  cell: GridCell,
  originalResult: CellResult
): Promise<ConsistencyResult> {
  const { analyzeCell, filterResult } = await import('../pipeline/gemini-client.js');
  const { stitchCellImage } = await import('../imagery/tile-stitcher.js');
  const { fetchLocationContext } = await import('../pipeline/location-context.js');

  const imageBase64 = await stitchCellImage(cell);
  const locationContext = await fetchLocationContext(cell.center.lat, cell.center.lng, 800);
  const rerunPipeline = await analyzeCell(
    imageBase64,
    originalResult.buildingType,
    cell.center,
    locationContext
  );
  const rerunFiltered = await filterResult(
    rerunPipeline,
    originalResult.buildingType,
    cell.center,
    locationContext
  );

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
