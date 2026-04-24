/**
 * Location context fetcher for the research pipeline.
 * Mirrors src/services/locationContext.ts from production but adapted for Node.
 *
 * Provides ground-truth Overpass land use data + reverse geocoded address
 * that gets injected into the LLM prompt so the model has real context
 * instead of hallucinating from the satellite image alone.
 */

export interface GeoFeature {
  name: string;
  type: string;
}

export interface LandUseZone {
  type: string;
  name?: string;
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

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function overpassQuery(query: string): Promise<{ elements?: unknown[] }> {
  let lastErr: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!resp.ok) {
        lastErr = new Error(`${endpoint}: HTTP ${resp.status}`);
        continue;
      }
      const text = await resp.text();
      // Some endpoints return XML on error
      if (!text.trim().startsWith('{')) {
        lastErr = new Error(`${endpoint}: non-JSON response`);
        continue;
      }
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('All Overpass endpoints failed');
}

async function fetchLandUseData(lat: number, lng: number, radius: number) {
  const query = `
[out:json][timeout:25];
(
  way["natural"="water"](around:${radius},${lat},${lng});
  way["landuse"~"forest|military|cemetery|residential|commercial|industrial|retail|construction|farmland"](around:${radius},${lat},${lng});
  way["building"](around:${radius},${lat},${lng});
);
out tags center;
`;

  const data = await overpassQuery(query);
  const elements = (data.elements ?? []) as Array<Record<string, unknown>>;

  const waterBodies: GeoFeature[] = [];
  const forests: GeoFeature[] = [];
  const protectedAreas: GeoFeature[] = [];
  const militaryZones: GeoFeature[] = [];
  const cemeteries: GeoFeature[] = [];
  const landUseZones: LandUseZone[] = [];
  let buildingCount = 0;

  for (const el of elements) {
    const tags = (el.tags as Record<string, string> | undefined) ?? {};
    const name =
      tags.name ?? tags.waterway ?? tags.natural ?? tags.landuse ?? 'Unnamed';

    if (tags.building) {
      buildingCount++;
      continue;
    }
    if (tags.natural === 'water' || tags.waterway) {
      waterBodies.push({ name, type: tags.waterway ?? 'water' });
      continue;
    }
    if (tags.natural === 'wood' || tags.landuse === 'forest') {
      forests.push({ name, type: tags.natural ?? tags.landuse });
      continue;
    }
    if (
      tags.leisure === 'nature_reserve' ||
      tags.boundary === 'protected_area' ||
      tags.boundary === 'national_park'
    ) {
      protectedAreas.push({ name, type: tags.boundary ?? tags.leisure });
      continue;
    }
    if (tags.landuse === 'military') {
      militaryZones.push({ name, type: 'military' });
      continue;
    }
    if (tags.landuse === 'cemetery') {
      cemeteries.push({ name, type: 'cemetery' });
      continue;
    }
    if (tags.landuse) {
      landUseZones.push({ type: tags.landuse, name: tags.name });
    }
  }

  return {
    waterBodies,
    forests,
    protectedAreas,
    militaryZones,
    cemeteries,
    landUseZones,
    buildingCount,
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      { headers: { 'User-Agent': 'PlotPal-AI/1.0' } }
    );
    if (!resp.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = (await resp.json()) as { display_name?: string };
    return data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

function buildContextSummary(ctx: LocationContext): string {
  const lines: string[] = [`Area: ${ctx.address}`];

  if (ctx.waterBodies.length > 0) {
    lines.push(
      `Water bodies in area: ${dedupe(ctx.waterBodies.map((w) => w.name)).slice(0, 5).join(', ')}`
    );
  } else {
    lines.push('Water bodies in area: NONE detected');
  }

  if (ctx.forests.length > 0) {
    lines.push(
      `Forests/woods in area: ${dedupe(ctx.forests.map((f) => f.name)).slice(0, 5).join(', ')}`
    );
  } else {
    lines.push('Forests/woods in area: NONE detected');
  }

  if (ctx.protectedAreas.length > 0) {
    lines.push(
      `Protected areas/nature reserves: ${dedupe(ctx.protectedAreas.map((p) => p.name)).slice(0, 5).join(', ')}`
    );
  }

  if (ctx.landUseZones.length > 0) {
    lines.push(
      `Land use types present: ${dedupe(ctx.landUseZones.map((z) => z.type)).slice(0, 8).join(', ')}`
    );
  }

  lines.push(`Approximate building density: ${ctx.buildingCount} buildings within search radius`);

  const hardBlockers: string[] = [];
  if (ctx.waterBodies.length > 0)
    hardBlockers.push(...dedupe(ctx.waterBodies.map((w) => w.name)).slice(0, 3));
  if (ctx.militaryZones.length > 0)
    hardBlockers.push(...dedupe(ctx.militaryZones.map((m) => m.name)).slice(0, 2));

  if (hardBlockers.length > 0) {
    lines.push(`\nAvoid suggesting locations directly inside these: ${hardBlockers.join(', ')}`);
  }

  return lines.join('\n');
}

const FALLBACK_CONTEXT = (lat: number, lng: number): LocationContext => ({
  address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  waterBodies: [],
  forests: [],
  protectedAreas: [],
  militaryZones: [],
  cemeteries: [],
  landUseZones: [],
  buildingCount: 0,
  summary: 'Ground truth data unavailable. Verify all suggestions against the satellite image.',
});

/**
 * Fetch full location context (land use + address) for a coordinate.
 * Falls back gracefully if Overpass / Nominatim are unavailable.
 */
export async function fetchLocationContext(
  lat: number,
  lng: number,
  radius = 800
): Promise<LocationContext> {
  try {
    const [landUseData, address] = await Promise.all([
      fetchLandUseData(lat, lng, radius),
      reverseGeocode(lat, lng),
    ]);

    const context: LocationContext = {
      address,
      ...landUseData,
      summary: '',
    };
    context.summary = buildContextSummary(context);
    return context;
  } catch (error) {
    console.warn(
      `[location-context] Failed for ${lat},${lng}: ${error instanceof Error ? error.message : error}. Using fallback.`
    );
    return FALLBACK_CONTEXT(lat, lng);
  }
}

/** Polite delay helper for rate-limit aware callers. */
export async function rateLimitDelay(ms = 1000): Promise<void> {
  await delay(ms);
}
