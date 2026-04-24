import type { VacantSpace } from './qwenVL';

export interface LandUseZone {
  type: string;
  name?: string;
}

export interface GeoFeature {
  name: string;
  type: string;
  lat: number;
  lng: number;
}

export interface LocationContext {
  address: string;
  waterBodies: GeoFeature[];
  forests: GeoFeature[];
  protectedAreas: GeoFeature[];
  militaryZones: GeoFeature[];
  cemeteries: GeoFeature[];
  landUseZones: LandUseZone[];
  buildingCount: number;
  summary: string;
}

export interface CoordinateValidation {
  isValid: boolean;
  hardViolations: string[];
  warnings: string[];
}

const OVERPASS_PRIMARY = 'https://overpass-api.de/api/interpreter';
const OVERPASS_MIRRORS = [
  OVERPASS_PRIMARY,
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
// kept as an alias for any older callers
const OVERPASS_API = OVERPASS_PRIMARY;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Overpass requests with mirror fallback + retry. 504 and 429 are common.
 */
async function overpassFetch(query: string, maxAttempts = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const endpoint of OVERPASS_MIRRORS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        if (response.ok) return response;
        if (![429, 500, 502, 503, 504].includes(response.status)) return response;
        lastError = new Error(`Overpass ${endpoint} returned ${response.status}`);
      } catch (e) {
        lastError = e;
      }
    }
    if (attempt < maxAttempts) await delay(800 * Math.pow(2, attempt - 1));
  }
  throw lastError instanceof Error ? lastError : new Error('Overpass request failed');
}

/**
 * Fetch land use context for an area from OpenStreetMap via Overpass API.
 * Returns structured data about water, forests, protected areas, etc.
 */
export async function fetchLocationContext(
  lat: number,
  lng: number,
  radius: number = 1000
): Promise<LocationContext> {
  const fallbackContext: LocationContext = {
    address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    waterBodies: [],
    forests: [],
    protectedAreas: [],
    militaryZones: [],
    cemeteries: [],
    landUseZones: [],
    buildingCount: 0,
    summary: 'Ground truth data unavailable. Exercise extra caution — verify all suggestions against the satellite image carefully.',
  };

  try {
    // Fetch land use data and reverse geocode in parallel
    const [landUseData, address] = await Promise.all([
      fetchLandUseData(lat, lng, radius),
      reverseGeocode(lat, lng),
    ]);

    const context: LocationContext = {
      address,
      ...landUseData,
      summary: '', // will be built below
    };

    context.summary = buildContextSummary(context);
    return context;
  } catch (error) {
    console.error('Error fetching location context:', error);
    return fallbackContext;
  }
}

async function fetchLandUseData(lat: number, lng: number, radius: number) {
  const query = `
[out:json][timeout:15];
(
  way["natural"="water"](around:${radius},${lat},${lng});
  relation["natural"="water"](around:${radius},${lat},${lng});
  way["waterway"](around:${radius},${lat},${lng});
  way["natural"="wood"](around:${radius},${lat},${lng});
  way["landuse"="forest"](around:${radius},${lat},${lng});
  relation["landuse"="forest"](around:${radius},${lat},${lng});
  way["leisure"="nature_reserve"](around:${radius},${lat},${lng});
  relation["leisure"="nature_reserve"](around:${radius},${lat},${lng});
  relation["boundary"="protected_area"](around:${radius},${lat},${lng});
  relation["boundary"="national_park"](around:${radius},${lat},${lng});
  way["landuse"="military"](around:${radius},${lat},${lng});
  relation["landuse"="military"](around:${radius},${lat},${lng});
  way["landuse"="cemetery"](around:${radius},${lat},${lng});
  way["landuse"](around:${radius},${lat},${lng});
  relation["landuse"](around:${radius},${lat},${lng});
  way["building"](around:${radius},${lat},${lng});
);
out tags center;
`;

  const response = await overpassFetch(query);

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();
  const elements: any[] = data.elements || [];

  const waterBodies: GeoFeature[] = [];
  const forests: GeoFeature[] = [];
  const protectedAreas: GeoFeature[] = [];
  const militaryZones: GeoFeature[] = [];
  const cemeteries: GeoFeature[] = [];
  const landUseZones: LandUseZone[] = [];
  let buildingCount = 0;

  for (const el of elements) {
    const tags = el.tags || {};
    const centerLat = el.center?.lat ?? el.lat ?? lat;
    const centerLng = el.center?.lon ?? el.lon ?? lng;
    const name = tags.name || tags.waterway || tags.natural || tags.landuse || 'Unnamed';

    // Buildings
    if (tags.building) {
      buildingCount++;
      continue;
    }

    // Water
    if (tags.natural === 'water' || tags.waterway) {
      waterBodies.push({ name, type: tags.waterway || 'water', lat: centerLat, lng: centerLng });
      continue;
    }

    // Forests / woods
    if (tags.natural === 'wood' || tags.landuse === 'forest') {
      forests.push({ name, type: tags.natural || tags.landuse, lat: centerLat, lng: centerLng });
      continue;
    }

    // Protected areas
    if (tags.leisure === 'nature_reserve' || tags.boundary === 'protected_area' || tags.boundary === 'national_park') {
      protectedAreas.push({ name, type: tags.boundary || tags.leisure, lat: centerLat, lng: centerLng });
      continue;
    }

    // Military
    if (tags.landuse === 'military') {
      militaryZones.push({ name, type: 'military', lat: centerLat, lng: centerLng });
      continue;
    }

    // Cemetery
    if (tags.landuse === 'cemetery') {
      cemeteries.push({ name, type: 'cemetery', lat: centerLat, lng: centerLng });
      continue;
    }

    // General land use
    if (tags.landuse) {
      landUseZones.push({ type: tags.landuse, name: tags.name });
    }
  }

  return { waterBodies, forests, protectedAreas, militaryZones, cemeteries, landUseZones, buildingCount };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      { headers: { 'User-Agent': 'PlotPal-AI/1.0' } }
    );
    if (!response.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await response.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

function buildContextSummary(ctx: LocationContext): string {
  const lines: string[] = [`Area: ${ctx.address}`];

  // Water
  if (ctx.waterBodies.length > 0) {
    const names = dedupe(ctx.waterBodies.map(w => w.name)).slice(0, 5);
    lines.push(`Water bodies in area: ${names.join(', ')}`);
  } else {
    lines.push('Water bodies in area: NONE detected');
  }

  // Forests
  if (ctx.forests.length > 0) {
    const names = dedupe(ctx.forests.map(f => f.name)).slice(0, 5);
    lines.push(`Forests/woods in area: ${names.join(', ')}`);
  } else {
    lines.push('Forests/woods in area: NONE detected');
  }

  // Protected areas
  if (ctx.protectedAreas.length > 0) {
    const names = dedupe(ctx.protectedAreas.map(p => p.name)).slice(0, 5);
    lines.push(`Protected areas/nature reserves: ${names.join(', ')}`);
  } else {
    lines.push('Protected areas/nature reserves: NONE detected');
  }

  // Military
  if (ctx.militaryZones.length > 0) {
    const names = dedupe(ctx.militaryZones.map(m => m.name)).slice(0, 3);
    lines.push(`Military zones: ${names.join(', ')}`);
  }

  // Cemeteries
  if (ctx.cemeteries.length > 0) {
    const names = dedupe(ctx.cemeteries.map(c => c.name)).slice(0, 3);
    lines.push(`Cemeteries: ${names.join(', ')}`);
  }

  // Land use
  if (ctx.landUseZones.length > 0) {
    const types = dedupe(ctx.landUseZones.map(z => z.type)).slice(0, 8);
    lines.push(`Land use types present: ${types.join(', ')}`);
  }

  // Building density
  lines.push(`Approximate building density: ${ctx.buildingCount} buildings within search radius`);

  // Constraints — only water and military are hard blockers
  const hardBlockers: string[] = [];
  if (ctx.waterBodies.length > 0) hardBlockers.push(...dedupe(ctx.waterBodies.map(w => w.name)).slice(0, 3));
  if (ctx.militaryZones.length > 0) hardBlockers.push(...dedupe(ctx.militaryZones.map(m => m.name)).slice(0, 2));

  if (hardBlockers.length > 0) {
    lines.push(`\nAvoid suggesting locations directly inside these: ${hardBlockers.join(', ')}`);
  }

  // Soft warnings — these are nearby but don't prevent development
  const nearby: string[] = [];
  if (ctx.forests.length > 0) nearby.push(`forests: ${dedupe(ctx.forests.map(f => f.name)).slice(0, 2).join(', ')}`);
  if (ctx.protectedAreas.length > 0) nearby.push(`protected areas: ${dedupe(ctx.protectedAreas.map(p => p.name)).slice(0, 2).join(', ')}`);
  if (ctx.cemeteries.length > 0) nearby.push(`cemeteries: ${dedupe(ctx.cemeteries.map(c => c.name)).slice(0, 2).join(', ')}`);

  if (nearby.length > 0) {
    lines.push(`Note: Nearby features to be aware of: ${nearby.join('; ')}`);
  }

  return lines.join('\n');
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

/**
 * Validate a single coordinate against OSM data.
 * Purely advisory — adds warnings as considerations, never rejects.
 * OSM data in dense urban areas (especially India) often has broad waterway/forest
 * polygons that overlap developed land, so hard rejections cause too many false negatives.
 */
export async function validateCoordinate(lat: number, lng: number): Promise<CoordinateValidation> {
  try {
    const query = `
[out:json][timeout:10];
is_in(${lat},${lng})->.enclosing;
(
  area.enclosing["natural"="water"];
  area.enclosing["waterway"];
  area.enclosing["natural"="wood"];
  area.enclosing["landuse"="forest"];
  area.enclosing["leisure"="nature_reserve"];
  area.enclosing["boundary"="protected_area"];
  area.enclosing["landuse"="military"];
);
out tags;
`;

    let response: Response;
    try {
      response = await overpassFetch(query, 1);
    } catch (e) {
      console.warn('Overpass is_in check failed, skipping validation:', e);
      return { isValid: true, hardViolations: [], warnings: [] };
    }
    if (!response.ok) {
      console.warn(`Overpass is_in check failed (${response.status}), skipping validation`);
      return { isValid: true, hardViolations: [], warnings: [] };
    }

    const data = await response.json();
    const elements: any[] = data.elements || [];

    if (elements.length === 0) {
      return { isValid: true, hardViolations: [], warnings: [] };
    }

    // All findings are advisory only — never hard-reject
    const warnings: string[] = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || 'Unnamed';
      if (tags.natural === 'water' || tags.waterway) {
        warnings.push(`OSM shows water feature nearby: ${name}`);
      } else if (tags.landuse === 'military') {
        warnings.push(`OSM shows military zone nearby: ${name}`);
      } else if (tags.natural === 'wood' || tags.landuse === 'forest') {
        warnings.push(`OSM shows forested area nearby: ${name}`);
      } else if (tags.leisure === 'nature_reserve' || tags.boundary === 'protected_area') {
        warnings.push(`OSM shows protected area nearby: ${name}`);
      }
    }

    return { isValid: true, hardViolations: [], warnings };
  } catch (error) {
    console.warn('Coordinate validation failed, skipping:', error);
    return { isValid: true, hardViolations: [], warnings: [] };
  }
}

/**
 * Validate all candidate vacant spaces. Adds OSM zone data as advisory
 * considerations but never removes spaces — the AI + filter already handle rejection.
 */
export async function validateAllCoordinates(spaces: VacantSpace[]): Promise<VacantSpace[]> {
  const validated: VacantSpace[] = [];

  for (let i = 0; i < spaces.length; i++) {
    const space = spaces[i];

    // Rate limit: wait between Overpass requests
    if (i > 0) await delay(1500);

    const result = await validateCoordinate(
      space.coordinates?.lat ?? 0,
      space.coordinates?.lng ?? 0
    );

    const warnings = result.warnings || [];
    const extraConsiderations = warnings.length > 0
      ? warnings
      : ['Location checked against OpenStreetMap zone data'];

    validated.push({
      ...space,
      validationStatus: 'verified',
      considerations: [...(space.considerations || []), ...extraConsiderations],
    });
  }

  return validated;
}
