/**
 * Shortlist ~500 urban-focused cells from the full Mumbai grid.
 *
 * Strategy: Define Mumbai's known urban corridors and dense zones,
 * score each land cell by proximity to urban centers, and take the top ~500.
 */

import fs from 'fs';
import path from 'path';
import { PATHS } from '../config.js';
import { GridCell } from '../types.js';

/** Known urban centers / dense zones in Mumbai with radius weights */
const URBAN_CENTERS = [
  // South Mumbai — dense historic core
  { lat: 18.9220, lng: 72.8347, weight: 1.0, name: 'Colaba/Fort' },
  { lat: 18.9388, lng: 72.8354, weight: 1.0, name: 'Marine Drive' },
  { lat: 18.9550, lng: 72.8400, weight: 0.95, name: 'Girgaon/Charni Rd' },
  { lat: 18.9650, lng: 72.8310, weight: 0.95, name: 'Grant Road/Tardeo' },
  { lat: 18.9750, lng: 72.8260, weight: 0.90, name: 'Mahalaxmi' },

  // Central Mumbai — commercial + residential hub
  { lat: 18.9940, lng: 72.8400, weight: 0.95, name: 'Lower Parel/Worli' },
  { lat: 19.0170, lng: 72.8440, weight: 0.95, name: 'Dadar' },
  { lat: 19.0170, lng: 72.8560, weight: 0.90, name: 'Sion/Matunga' },
  { lat: 19.0360, lng: 72.8550, weight: 0.90, name: 'Kurla' },
  { lat: 19.0450, lng: 72.8200, weight: 0.90, name: 'Bandra' },

  // Western Suburbs — dense urban
  { lat: 19.0600, lng: 72.8370, weight: 0.85, name: 'Khar/Santacruz' },
  { lat: 19.0770, lng: 72.8500, weight: 0.85, name: 'Vile Parle' },
  { lat: 19.1070, lng: 72.8370, weight: 0.85, name: 'Juhu' },
  { lat: 19.1190, lng: 72.8460, weight: 0.85, name: 'Andheri West' },
  { lat: 19.1190, lng: 72.8680, weight: 0.80, name: 'Andheri East' },
  { lat: 19.1400, lng: 72.8490, weight: 0.80, name: 'Goregaon' },
  { lat: 19.1640, lng: 72.8490, weight: 0.75, name: 'Malad' },
  { lat: 19.1860, lng: 72.8490, weight: 0.70, name: 'Kandivali' },
  { lat: 19.2170, lng: 72.8520, weight: 0.65, name: 'Borivali' },
  { lat: 19.2300, lng: 72.8600, weight: 0.60, name: 'Dahisar' },

  // Eastern Suburbs
  { lat: 19.0750, lng: 72.8830, weight: 0.80, name: 'Chembur' },
  { lat: 19.0860, lng: 72.9080, weight: 0.75, name: 'Govandi' },
  { lat: 19.0900, lng: 72.8870, weight: 0.80, name: 'Ghatkopar' },
  { lat: 19.1130, lng: 72.8900, weight: 0.75, name: 'Vikhroli' },
  { lat: 19.1370, lng: 72.9100, weight: 0.70, name: 'Bhandup' },
  { lat: 19.1700, lng: 72.9400, weight: 0.65, name: 'Mulund' },

  // Navi Mumbai fringe
  { lat: 19.0440, lng: 72.8800, weight: 0.70, name: 'BKC' },
  { lat: 19.0280, lng: 72.8850, weight: 0.70, name: 'Wadala' },
];

/**
 * Compute urban score for a cell based on proximity to urban centers.
 * Uses inverse-distance weighting with Gaussian falloff.
 */
function urbanScore(cell: GridCell): number {
  let score = 0;
  const SIGMA = 0.015; // ~1.5km falloff in degrees

  for (const center of URBAN_CENTERS) {
    const dLat = cell.center.lat - center.lat;
    const dLng = cell.center.lng - center.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    score += center.weight * Math.exp(-(dist * dist) / (2 * SIGMA * SIGMA));
  }

  return score;
}

export interface ShortlistedCell extends GridCell {
  urbanScore: number;
}

/**
 * Score and rank all land cells, return top N urban cells.
 */
export function shortlistUrbanCells(
  cells: GridCell[],
  targetCount: number = 500
): ShortlistedCell[] {
  const landCells = cells.filter((c) => c.isLand);

  // Score each cell
  const scored: ShortlistedCell[] = landCells.map((cell) => ({
    ...cell,
    urbanScore: urbanScore(cell),
  }));

  // Sort by urban score descending
  scored.sort((a, b) => b.urbanScore - a.urbanScore);

  // Take top N
  const shortlisted = scored.slice(0, targetCount);

  return shortlisted;
}

/**
 * Run shortlisting and save to disk.
 */
export function shortlistAndSave(targetCount: number = 500): ShortlistedCell[] {
  if (!fs.existsSync(PATHS.grid)) {
    throw new Error('Grid not found. Run "npm run grid" first.');
  }

  const cells: GridCell[] = JSON.parse(fs.readFileSync(PATHS.grid, 'utf-8'));
  const shortlisted = shortlistUrbanCells(cells, targetCount);

  const outPath = path.join(path.dirname(PATHS.grid), 'shortlisted.json');
  fs.writeFileSync(outPath, JSON.stringify(shortlisted, null, 2));

  // Print distribution summary
  const regions = new Map<string, number>();
  for (const cell of shortlisted) {
    let region: string;
    if (cell.center.lat < 18.98) region = 'South Mumbai';
    else if (cell.center.lat < 19.05) region = 'Central Mumbai';
    else if (cell.center.lat < 19.15) region = 'Western/Eastern Suburbs';
    else region = 'Northern Suburbs';
    regions.set(region, (regions.get(region) || 0) + 1);
  }

  console.log(`\nShortlisted ${shortlisted.length} urban cells (from ${cells.filter(c => c.isLand).length} land cells)`);
  console.log(`Score range: ${shortlisted[shortlisted.length - 1].urbanScore.toFixed(4)} — ${shortlisted[0].urbanScore.toFixed(4)}`);
  console.log('\nRegion distribution:');
  for (const [region, count] of regions) {
    console.log(`  ${region}: ${count} cells`);
  }

  return shortlisted;
}
