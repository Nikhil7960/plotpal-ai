import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { TILE_ZOOM, PATHS } from '../config.js';
import { fetchTile, getTileCoordsForBounds } from './tile-fetcher.js';
import { GridCell } from '../types.js';

const TILE_SIZE = 256;

/**
 * Convert lat/lng to pixel coordinates within a tile grid.
 */
function latLngToPixel(
  lat: number,
  lng: number,
  zoom: number,
  originTileX: number,
  originTileY: number
): { px: number; py: number } {
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const px = (x - originTileX) * TILE_SIZE;
  const py = (y - originTileY) * TILE_SIZE;
  return { px: Math.round(px), py: Math.round(py) };
}

/**
 * Fetch tiles for a cell, stitch them, crop to cell bounds, and return as base64 PNG.
 * Also saves the image to disk.
 */
export async function stitchCellImage(cell: GridCell): Promise<string> {
  const imageDir = PATHS.images;
  const imagePath = path.join(imageDir, `${cell.id}.png`);

  // Check cache
  if (fs.existsSync(imagePath)) {
    const buf = fs.readFileSync(imagePath);
    return buf.toString('base64');
  }

  const tileCoords = getTileCoordsForBounds(cell.bounds, TILE_ZOOM);

  // Fetch all tiles
  const tileBuffers: { x: number; y: number; buffer: Buffer }[] = [];
  for (const tc of tileCoords) {
    const buffer = await fetchTile(TILE_ZOOM, tc.x, tc.y);
    tileBuffers.push({ ...tc, buffer });
  }

  // Determine origin tile (top-left)
  const minTileX = Math.min(...tileCoords.map((t) => t.x));
  const minTileY = Math.min(...tileCoords.map((t) => t.y));
  const maxTileX = Math.max(...tileCoords.map((t) => t.x));
  const maxTileY = Math.max(...tileCoords.map((t) => t.y));

  const gridWidth = (maxTileX - minTileX + 1) * TILE_SIZE;
  const gridHeight = (maxTileY - minTileY + 1) * TILE_SIZE;

  // Composite tiles onto a blank canvas using sharp
  const composites = tileBuffers.map((tile) => ({
    input: tile.buffer,
    left: (tile.x - minTileX) * TILE_SIZE,
    top: (tile.y - minTileY) * TILE_SIZE,
  }));

  // Create blank background and composite tiles
  const stitched = await sharp({
    create: {
      width: gridWidth,
      height: gridHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  // Compute pixel coords for cell bounds within the tile grid
  const topLeft = latLngToPixel(
    cell.bounds.latMax, cell.bounds.lngMin,
    TILE_ZOOM, minTileX, minTileY
  );
  const bottomRight = latLngToPixel(
    cell.bounds.latMin, cell.bounds.lngMax,
    TILE_ZOOM, minTileX, minTileY
  );

  const cropX = Math.max(0, topLeft.px);
  const cropY = Math.max(0, topLeft.py);
  const cropW = Math.min(gridWidth - cropX, bottomRight.px - topLeft.px);
  const cropH = Math.min(gridHeight - cropY, bottomRight.py - topLeft.py);

  // Crop to cell bounds and resize to ~400x400
  const outputSize = 400;
  const cropped = await sharp(stitched)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .resize(outputSize, outputSize, { fit: 'fill' })
    .png()
    .toBuffer();

  // Save to disk
  fs.mkdirSync(imageDir, { recursive: true });
  fs.writeFileSync(imagePath, cropped);

  return cropped.toString('base64');
}
