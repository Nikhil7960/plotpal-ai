import { MUMBAI_BBOX, CELL_SIZE, PATHS, OUTPUT_DIR } from '../config.js';
import { fetchMumbaiBoundary, pointInPolygon } from './land-mask.js';
import { GridCell } from '../types.js';
import fs from 'fs';
import path from 'path';

export async function generateGrid(): Promise<GridCell[]> {
  console.log('Fetching Mumbai boundary from Overpass API...');
  const boundary = await fetchMumbaiBoundary();
  console.log(`Boundary polygon has ${boundary.length} points`);

  const cells: GridCell[] = [];
  const rows = Math.ceil(
    (MUMBAI_BBOX.latMax - MUMBAI_BBOX.latMin) / CELL_SIZE.latDeg
  );
  const cols = Math.ceil(
    (MUMBAI_BBOX.lngMax - MUMBAI_BBOX.lngMin) / CELL_SIZE.lngDeg
  );

  console.log(`Grid dimensions: ${rows} rows × ${cols} cols = ${rows * cols} raw cells`);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const latMin = MUMBAI_BBOX.latMin + row * CELL_SIZE.latDeg;
      const latMax = latMin + CELL_SIZE.latDeg;
      const lngMin = MUMBAI_BBOX.lngMin + col * CELL_SIZE.lngDeg;
      const lngMax = lngMin + CELL_SIZE.lngDeg;

      const center = {
        lat: (latMin + latMax) / 2,
        lng: (lngMin + lngMax) / 2,
      };

      const isLand = pointInPolygon(center.lat, center.lng, boundary);

      cells.push({
        id: `cell_${row}_${col}`,
        row,
        col,
        center,
        bounds: { latMin, latMax, lngMin, lngMax },
        isLand,
      });
    }
  }

  const landCells = cells.filter((c) => c.isLand);
  console.log(
    `Total cells: ${cells.length}, Land cells: ${landCells.length}, Water/outside: ${cells.length - landCells.length}`
  );

  return cells;
}

export async function generateAndSaveGrid(): Promise<GridCell[]> {
  const cells = await generateGrid();

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(PATHS.grid), { recursive: true });
  fs.writeFileSync(PATHS.grid, JSON.stringify(cells, null, 2));
  console.log(`Grid saved to ${PATHS.grid}`);

  return cells;
}
