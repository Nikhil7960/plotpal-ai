import { GoogleGenAI } from '@google/genai';
import { getApiKey, MODELS } from '../config.js';
import { AnalysisResult, VacantSpace } from '../types.js';
import { LocationContext } from './location-context.js';
import { withRetry } from './retry.js';

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: getApiKey() });
  }
  return aiInstance;
}

const BUILDING_CONTEXT: Record<string, string> = {
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
  retail: 'a retail store with customer area, storage, and parking',
};

/**
 * Build the analysis prompt. Mirrors src/services/qwenVL.ts production prompt
 * exactly so the fine-tuned model learns the same input format the app uses.
 */
export function buildAnalysisPrompt(
  buildingType: string,
  center: { lat: number; lng: number },
  locationContext: LocationContext
): string {
  const buildingDescription = BUILDING_CONTEXT[buildingType] ?? buildingType;
  const groundTruthSection = `\n== AREA CONTEXT (from OpenStreetMap) ==\n${locationContext.summary}\n`;

  return `You are an expert urban planner analyzing satellite imagery to identify vacant or underutilized spaces suitable for building ${buildingDescription}.

Location: ${locationContext.address}
Map Center: ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}
Building Type: ${buildingType}
${groundTruthSection}
== WHAT TO LOOK FOR ==
Identify 2-4 spaces in the satellite image that appear suitable for development:
1. Empty/cleared lots with no structures (bare earth, gravel, unused land)
2. Large underutilized parking areas or open concrete areas
3. Abandoned, derelict, or clearly unused buildings/compounds
4. Underutilized industrial or commercial parcels
5. Gaps between developed areas that appear vacant

== WHAT TO AVOID ==
Do NOT suggest locations that are:
- Directly inside a visible water body (river, lake, ocean)
- Inside a military installation
- On top of existing occupied residential buildings or apartment complexes

== IMPORTANT ==
- Coordinates MUST be within the visible satellite image area (close to the map center)
- Existing buildings with people living in them are NOT vacant — look for genuinely empty land
- Urban areas often have small vacant plots between buildings — these ARE valid suggestions
- If you can see open/bare land in the image, suggest it even if the area is densely developed nearby

Return ONLY valid JSON in this EXACT format:
{
  "vacantSpaces": [
    {
      "location": "Descriptive location using visible landmarks and streets",
      "coordinates": { "lat": <latitude>, "lng": <longitude> },
      "suitability": <0-100>,
      "reasons": ["Reason 1", "Reason 2", "Reason 3"],
      "considerations": ["Challenge 1", "Challenge 2"],
      "description": "2-3 sentence description of the space"
    }
  ],
  "analysis": "Overall area assessment for ${buildingType} development",
  "confidence": <0-100>
}`;
}

/**
 * Analyze a single cell with the production prompt format.
 * Returns the raw AI result before filtering.
 */
export async function analyzeCell(
  imageBase64: string,
  buildingType: string,
  center: { lat: number; lng: number },
  locationContext: LocationContext
): Promise<AnalysisResult> {
  const ai = getAI();
  const prompt = buildAnalysisPrompt(buildingType, center, locationContext);

  return withRetry(
    async () => {
      const response = await ai.models.generateContent({
        model: MODELS.vision,
        config: { temperature: 0.3 },
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/png', data: imageBase64 } },
            ],
          },
        ],
      });

      const content = response.text ?? '';
      if (!content.trim()) {
        throw new Error('Empty response from vision model');
      }
      return parseAnalysisResult(content, center);
    },
    `vision(${buildingType},${center.lat.toFixed(3)},${center.lng.toFixed(3)})`,
    { maxRetries: 3, baseDelayMs: 3000 }
  );
}

/**
 * Index-based filter — returns indices of spaces to KEEP rather than full
 * objects, so the LLM cannot accidentally hallucinate the JSON schema and
 * lose data (see geminiFilter.ts in production for the bug history).
 */
const FILTER_SYSTEM_INSTRUCTION = `You are an urban planning quality checker. Your job is to review proposed development sites and remove only CLEARLY inappropriate ones.

BIAS: When in doubt, KEEP the space. Only remove a space if you are confident it is unsuitable.

REMOVE a space ONLY if:
- It is directly on top of a water body (river, lake, ocean — NOT just nearby)
- It is inside a military base
- It is on top of an active highway, railway track, or airport runway

DO NOT remove a space just because:
- The area has flood risk (most coastal cities have some flood risk)
- It is in a residential zone (vacant plots exist within residential areas)
- There is nearby infrastructure (proximity to roads is actually good)
- The broader area has environmental concerns
- There are parks or green spaces nearby

Return ONLY valid JSON in the requested format.`;

interface FilterDecision {
  keepIndices?: number[];
  removedReasons?: Record<string, string>;
  analysis?: string;
  confidence?: number;
}

export async function filterResult(
  result: AnalysisResult,
  buildingType: string,
  center: { lat: number; lng: number },
  locationContext: LocationContext
): Promise<AnalysisResult> {
  if (!result.vacantSpaces || result.vacantSpaces.length === 0) {
    return result;
  }

  const ai = getAI();
  const numberedSpaces = result.vacantSpaces
    .map(
      (s, i) =>
        `[${i}] "${s.location}" at (${s.coordinates.lat.toFixed(6)}, ${s.coordinates.lng.toFixed(6)}) — ${s.description}`
    )
    .join('\n');

  const userContent = `Review these proposed vacant spaces for ${buildingType} development in ${locationContext.address}.

OPENSTREETMAP DATA FOR THIS AREA:
${locationContext.summary}

PROPOSED LOCATIONS (each has an index in brackets):
${numberedSpaces}

TASK: For each location, decide whether to KEEP or REMOVE it.

REMOVE only if you are CONFIDENT the location is:
- Directly on top of a water body (river, lake, ocean — NOT just nearby)
- Inside a military base
- On top of an active highway, railway track, or runway

KEEP everything else. Urban plots in residential/commercial areas ARE valid candidates.

Return ONLY this JSON (no other text, no markdown fences):
{
  "keepIndices": [0, 1, 2, 3],
  "removedReasons": { "indexNumber": "reason" },
  "analysis": "Brief assessment of the area",
  "confidence": 80
}

The keepIndices array MUST contain the integer index numbers (0-based) of spaces to KEEP.
Bias heavily toward keeping — only remove if clearly unsuitable.`;

  try {
    return await withRetry(
      async () => {
        const response = await ai.models.generateContent({
          model: MODELS.filter,
          config: {
            temperature: 0.2,
            systemInstruction: [{ text: FILTER_SYSTEM_INSTRUCTION }],
          },
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
        });

        const content = response.text ?? '';
        if (!content.trim()) {
          throw new Error('Empty response from filter model');
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON in filter response');
        }

        const decision: FilterDecision = JSON.parse(jsonMatch[0]);

        const validIndices = Array.isArray(decision.keepIndices)
          ? decision.keepIndices.filter(
              (i): i is number =>
                Number.isInteger(i) && i >= 0 && i < result.vacantSpaces.length
            )
          : result.vacantSpaces.map((_, i) => i);

        const filteredSpaces: VacantSpace[] = validIndices.map((i) => result.vacantSpaces[i]);

        return {
          vacantSpaces: filteredSpaces,
          analysis: decision.analysis ?? result.analysis,
          confidence:
            typeof decision.confidence === 'number'
              ? Math.min(100, Math.max(0, decision.confidence))
              : result.confidence,
        };
      },
      `filter(${buildingType},${center.lat.toFixed(3)},${center.lng.toFixed(3)})`,
      { maxRetries: 3, baseDelayMs: 3000 }
    );
  } catch (error) {
    console.warn(
      `[fallback] Filter failed for ${center.lat.toFixed(4)},${center.lng.toFixed(4)}: ${error instanceof Error ? error.message : error}. Using unfiltered result.`
    );
    return result;
  }
}

function parseAnalysisResult(
  content: string,
  center: { lat: number; lng: number }
): AnalysisResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Malformed JSON in response: ${(e as Error).message}`);
  }

  const rawSpaces = (raw.vacantSpaces as unknown[]) ?? [];
  const vacantSpaces: VacantSpace[] = rawSpaces.map((entry, index) => {
    const space = (entry ?? {}) as Record<string, unknown>;
    const coords = (space.coordinates ?? {}) as Record<string, unknown>;
    return {
      location: typeof space.location === 'string' ? space.location : `Site ${index + 1}`,
      coordinates: {
        lat: Number(coords.lat) || center.lat,
        lng: Number(coords.lng) || center.lng,
      },
      suitability: Math.min(100, Math.max(0, Number(space.suitability) || 75)),
      reasons: Array.isArray(space.reasons)
        ? (space.reasons as string[])
        : ['Suitable location identified'],
      considerations: Array.isArray(space.considerations)
        ? (space.considerations as string[])
        : ['Further analysis recommended'],
      description:
        typeof space.description === 'string' ? space.description : 'Potential development site',
    };
  });

  return {
    vacantSpaces,
    analysis: typeof raw.analysis === 'string' ? raw.analysis : 'Analysis completed',
    confidence: Math.min(100, Math.max(0, Number(raw.confidence) || 80)),
  };
}
