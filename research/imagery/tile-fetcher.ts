import fs from 'fs';
import path from 'path';
import { ESRI_TILE_URL, PATHS } from '../config.js';
import { withRetry } from '../pipeline/retry.js';

/**
 * Convert lat/lng to tile coordinates at a given zoom level.
 */
export function latLngToTile(
  lat: number,
  lng: number,
  zoom: number
): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/**
 * Fetch a single tile with retry, caching to disk.
 */
export async function fetchTile(
  z: number,
  x: number,
  y: number
): Promise<Buffer> {
  const cacheDir = PATHS.tiles;
  const cachePath = path.join(cacheDir, `${z}_${y}_${x}.png`);

  // Check cache
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath);
  }

  const url = `${ESRI_TILE_URL}/${z}/${y}/${x}`;

  const buffer = await withRetry(
    async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching tile ${z}/${y}/${x}`);
      }
      return Buffer.from(await res.arrayBuffer());
    },
    `tile ${z}/${y}/${x}`,
    { maxRetries: 4, baseDelayMs: 1000 }
  );

  // Cache to disk
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, buffer);

  return buffer;
}

/**
 * Get all tile coordinates needed to cover a bounding box at a given zoom.
 */
export function getTileCoordsForBounds(
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number },
  zoom: number
): { x: number; y: number }[] {
  const topLeft = latLngToTile(bounds.latMax, bounds.lngMin, zoom);
  const bottomRight = latLngToTile(bounds.latMin, bounds.lngMax, zoom);

  const tiles: { x: number; y: number }[] = [];
  for (let y = topLeft.y; y <= bottomRight.y; y++) {
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}
