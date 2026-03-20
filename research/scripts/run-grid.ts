/**
 * Step 1: Generate Mumbai grid and save to output/grid.json
 */
import { generateAndSaveGrid } from '../grid/generate-grid.js';

async function main() {
  console.log('=== Step 1: Grid Generation ===\n');
  const cells = await generateAndSaveGrid();
  const landCells = cells.filter((c) => c.isLand);

  console.log('\nSummary:');
  console.log(`  Total cells: ${cells.length}`);
  console.log(`  Land cells:  ${landCells.length}`);
  console.log(`  Water/outside: ${cells.length - landCells.length}`);
}

main().catch(console.error);
