import { GoogleGenAI } from '@google/genai';
import type { LocationContext } from './locationContext';
import { generateContentWithFallback } from './geminiRetry';
import { pixelToLatLng, isInBounds, type ImageBounds, type ImageSize } from './imageCoords';

export interface VacantSpace {
  location: string;
  coordinates: { lat: number; lng: number };
  suitability: number;
  reasons: string[];
  considerations: string[];
  description: string;
  validationStatus?: 'verified' | 'unverified';
  pixelCoordinates?: { x: number; y: number };
}

export interface AnalysisResult {
  vacantSpaces: VacantSpace[];
  analysis: string;
  confidence: number;
}

const BUILDING_CONTEXT = {
  cafe: 'a coffee shop or cafe with seating area, kitchen facilities, and customer parking',
  mall: 'a large shopping mall with multiple stores, parking facilities, food courts',
  park: 'a public park with green spaces, walking paths, recreational facilities',
  residential: 'a residential complex with apartments or houses, parking, and amenities',
  office: 'an office building for businesses with workspace and parking facilities',
  hospital: 'a medical facility with emergency services and medical equipment areas',
  school: 'an educational institution with classrooms and sports facilities',
  gym: 'a fitness center with exercise equipment and parking facilities',
  restaurant: 'a restaurant with dining area, kitchen, and customer parking',
  hotel: 'a hotel with guest rooms, lobby, restaurant, and parking',
  retail: 'a retail store with customer area, storage, and parking'
};

export async function analyzeVacantSpaceWithQwenVL(
  imageBase64: string,
  buildingType: string,
  location: string,
  mapCenter: { lat: number; lng: number },
  locationContext?: LocationContext,
  propertyMapBase64?: string,
  imageBounds?: ImageBounds,
  imageSize?: ImageSize
): Promise<AnalysisResult> {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    const buildingDescription = BUILDING_CONTEXT[buildingType as keyof typeof BUILDING_CONTEXT] || buildingType;

    const groundTruthSection = locationContext
      ? `\n== AREA CONTEXT (from OpenStreetMap) ==\n${locationContext.summary}\n`
      : '';

    const propertyMapNote = propertyMapBase64
      ? '\nA second image is provided showing property/zoning map overlay for this area. Use it to identify zones marked for development or vacant parcels.\n'
      : '';

    // If we have bounds + size, ask for pixel coords and convert in code.
    // Pixel coords are far more reliable than AI-estimated lat/lng.
    const pixelMode = !!(imageBounds && imageSize);

    const geoSection = pixelMode
      ? `\n== IMAGE COORDINATE SYSTEM ==
The satellite image is ${imageSize!.width} × ${imageSize!.height} pixels.
Pixel (0,0) is the TOP-LEFT corner. Pixel (${imageSize!.width - 1}, ${imageSize!.height - 1}) is the BOTTOM-RIGHT corner.

The image covers this geographic area:
- North edge (top):    latitude ${imageBounds!.north.toFixed(6)}
- South edge (bottom): latitude ${imageBounds!.south.toFixed(6)}
- West edge (left):    longitude ${imageBounds!.west.toFixed(6)}
- East edge (right):   longitude ${imageBounds!.east.toFixed(6)}

For each vacant space, you MUST return its pixel center (x, y) in the image. The system will convert pixel → lat/lng deterministically. Do NOT invent or approximate lat/lng yourself.\n`
      : `\nLocation: ${location}\nMap Center: ${mapCenter.lat.toFixed(6)}, ${mapCenter.lng.toFixed(6)}\n`;

    const prompt = `You are an expert urban planner analyzing satellite imagery to identify vacant or underutilized spaces suitable for building ${buildingDescription}.

Building Type: ${buildingType}
${geoSection}${groundTruthSection}${propertyMapNote}
== WHAT TO LOOK FOR ==
Identify 2-4 spaces in the satellite image that appear suitable for development:
1. Empty/cleared lots with no structures (bare earth, gravel, unused land)
2. Large underutilized parking areas or open concrete areas
3. Abandoned, derelict, or clearly unused buildings/compounds
4. Underutilized industrial or commercial parcels
5. Gaps between developed areas that appear vacant

== WHAT TO AVOID ==
Do NOT suggest locations that are:
- Directly on a visible water body (river, lake, ocean, creek)
- Inside a military installation
- On top of existing occupied residential buildings, slums, or dense informal settlements (rows of small structures with metal/blue roofs are slums — NOT vacant)
- On top of active roads, highways, or railway tracks

== BE STRICT ==
- If the pixel you pick has a building rooftop on it, that is NOT a vacant space — move to a truly empty pixel
- Open green areas like parks or playing fields are NOT vacant unless explicitly designated for redevelopment
- A dense grid of small buildings (chawls, slums) is NOT vacant even if roofs look similar — look for genuine BARE land only
- Prefer FEWER high-quality picks over many low-quality ones. If only 1 good spot exists, return just 1.

== OUTPUT FORMAT ==
Return ONLY valid JSON in this EXACT format:
{
  "vacantSpaces": [
    {
      "pixel": { "x": <integer pixel x>, "y": <integer pixel y> },
      "location": "Descriptive location using visible landmarks and streets",
      "suitability": <0-100>,
      "reasons": ["Reason 1", "Reason 2", "Reason 3"],
      "considerations": ["Challenge 1", "Challenge 2"],
      "description": "2-3 sentence description of the space"
    }
  ],
  "analysis": "Overall area assessment for ${buildingType} development",
  "confidence": <0-100>
}

${pixelMode ? 'CRITICAL: The "pixel" field must be the center of the vacant plot in image pixels. Aim for pixels where you can visually confirm bare land, cleared ground, or an empty parcel. Precision matters — if the vacant plot is 40 pixels wide, the pixel center should be within those 40 pixels, not on an adjacent building.' : 'Include "coordinates": { "lat": ..., "lng": ... } for each space.'}`;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt },
      { inlineData: { mimeType: 'image/png', data: imageBase64 } },
    ];

    if (propertyMapBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: propertyMapBase64 } });
    }

    const response = await generateContentWithFallback(ai, {
      config: { temperature: 0.3 },
      contents: [{ role: 'user', parts }],
    });

    const content = response.text ?? '';

    let raw: {
      vacantSpaces?: Array<{
        pixel?: { x: number; y: number };
        coordinates?: { lat: number; lng: number };
        location?: string;
        suitability?: number;
        reasons?: string[];
        considerations?: string[];
        description?: string;
      }>;
      analysis?: string;
      confidence?: number;
    };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      raw = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Failed to parse AI response');
    }

    const rawSpaces = Array.isArray(raw.vacantSpaces) ? raw.vacantSpaces : [];
    const spaces: VacantSpace[] = [];

    for (let i = 0; i < rawSpaces.length; i++) {
      const s = rawSpaces[i];
      let coords: { lat: number; lng: number } | null = null;
      let pixel: { x: number; y: number } | undefined;

      if (pixelMode && s.pixel && Number.isFinite(s.pixel.x) && Number.isFinite(s.pixel.y)) {
        pixel = { x: s.pixel.x, y: s.pixel.y };
        if (
          pixel.x >= 0 && pixel.x < imageSize!.width &&
          pixel.y >= 0 && pixel.y < imageSize!.height
        ) {
          coords = pixelToLatLng(pixel.x, pixel.y, imageBounds!, imageSize!);
        }
      } else if (s.coordinates && Number.isFinite(s.coordinates.lat) && Number.isFinite(s.coordinates.lng)) {
        coords = { lat: s.coordinates.lat, lng: s.coordinates.lng };
        if (imageBounds && !isInBounds(coords.lat, coords.lng, imageBounds, 0.1)) {
          console.warn(`Dropping space "${s.location}" — coordinates outside image bounds`);
          coords = null;
        }
      }

      if (!coords) {
        console.warn(`Dropping space "${s.location || `#${i}`}" — no valid coordinates from AI`);
        continue;
      }

      spaces.push({
        location: s.location || `Site ${i + 1}`,
        coordinates: coords,
        pixelCoordinates: pixel,
        suitability: Math.min(100, Math.max(0, s.suitability ?? 75)),
        reasons: Array.isArray(s.reasons) && s.reasons.length > 0 ? s.reasons : ['Suitable location identified'],
        considerations: Array.isArray(s.considerations) ? s.considerations : [],
        description: s.description || 'Potential development site',
      });
    }

    return {
      vacantSpaces: spaces,
      analysis: raw.analysis || 'Analysis completed',
      confidence: Math.min(100, Math.max(0, raw.confidence ?? 80)),
    };
  } catch (error) {
    console.error('Error analyzing with Gemini:', error);
    throw new Error(`Failed to analyze vacant spaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Geocoding using Nominatim (OpenStreetMap)
export async function geocodeLocation(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'PlotPal-AI/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
