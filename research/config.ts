import 'dotenv/config';

// Mumbai bounding box
export const MUMBAI_BBOX = {
  latMin: 18.89,
  latMax: 19.27,
  lngMin: 72.77,
  lngMax: 72.98,
};

// Cell size in degrees (~500m)
export const CELL_SIZE = {
  latDeg: 0.0045,   // ~500m latitude
  lngDeg: 0.00477,  // ~500m longitude at Mumbai's latitude
};

// Satellite tile zoom level
export const TILE_ZOOM = 17;

// Available infrastructure types
export const BUILDING_TYPES = [
  'cafe', 'mall', 'park', 'residential', 'office',
  'hospital', 'school', 'gym', 'restaurant', 'hotel', 'retail',
] as const;

export type BuildingType = typeof BUILDING_TYPES[number];

// Model configurations
export const MODELS = {
  vision: 'gemini-2.5-flash',
  filter: 'gemini-2.5-flash',
  judge: 'gemini-2.5-pro',
} as const;

// Rate limiting & concurrency
export const RATE_LIMIT = {
  requestsPerMinute: 120,
};

export const CONCURRENCY = 10;

// Evaluation sample sizes
export const EVAL_CONFIG = {
  consistencySampleSize: 50,
  positionBiasSampleSize: 100,
  pairwiseComparisonSize: 100,
};

// Esri tile URL
export const ESRI_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

// Output paths
export const OUTPUT_DIR = 'output';
export const PATHS = {
  grid: `${OUTPUT_DIR}/grid.json`,
  tiles: `${OUTPUT_DIR}/tiles`,
  images: `${OUTPUT_DIR}/images`,
  checkpoints: `${OUTPUT_DIR}/checkpoints`,
  results: `${OUTPUT_DIR}/results`,
  evaluation: `${OUTPUT_DIR}/evaluation`,
  reports: `${OUTPUT_DIR}/reports`,
};

export function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY not set in environment');
  }
  return key;
}
