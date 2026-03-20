import { GoogleGenAI } from '@google/genai';
import { getApiKey, MODELS, BUILDING_TYPES } from '../config.js';
import { AnalysisResult, VacantSpaceResearch } from '../types.js';
import { withRetry } from './retry.js';

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: getApiKey() });
  }
  return aiInstance;
}

/**
 * Re-tuned vision prompt: single run per cell, AI recommends infrastructure types.
 */
export async function analyzeCell(
  imageBase64: string,
  center: { lat: number; lng: number }
): Promise<AnalysisResult> {
  const ai = getAI();
  const typesList = BUILDING_TYPES.join(', ');

  const prompt = `You are an expert urban planner analyzing satellite imagery to identify vacant or underutilized spaces in Mumbai, India.

Cell Center: ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}
Cell Size: 500m × 500m

Available Infrastructure Types: ${typesList}

Analyze this satellite image and:
1. Identify 2-4 vacant or underutilized spaces
2. For EACH space, recommend which infrastructure type(s) from the list above would be MOST suitable, based on the surrounding context, accessibility, lot size, and neighborhood needs

Return ONLY valid JSON:
{
  "vacantSpaces": [
    {
      "location": "Descriptive location using visible landmarks",
      "coordinates": { "lat": <number>, "lng": <number> },
      "suitability": <0-100>,
      "recommendedTypes": ["type1", "type2"],
      "reasons": ["Reason 1", "Reason 2", "Reason 3"],
      "considerations": ["Challenge 1", "Challenge 2"],
      "description": "2-3 sentence description"
    }
  ],
  "analysis": "Overall area assessment",
  "confidence": <0-100>
}`;

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
    `vision(${center.lat.toFixed(3)},${center.lng.toFixed(3)})`,
    { maxRetries: 3, baseDelayMs: 3000 }
  );
}

/**
 * Filter stage — adapted from geminiFilter.ts for Node.
 */
const FILTER_SYSTEM_INSTRUCTION = `You are an expert urban planning validator. Your job is to filter out inappropriate vacant spaces that are NOT suitable for building development.

ELIMINATE spaces that are:
- Water bodies (lakes, rivers, seas, ponds, reservoirs)
- Protected natural areas (forests, wetlands, nature reserves)
- Agricultural land actively in use
- Steep slopes or mountainous terrain
- Flood-prone areas
- Existing infrastructure (roads, railways, airports)
- Cemeteries or religious sites
- Military or restricted zones

KEEP spaces that are:
- Empty urban lots
- Abandoned buildings or structures
- Large parking areas that could be repurposed
- Underutilized commercial/industrial sites
- Brownfield sites suitable for redevelopment

Return ONLY valid JSON with filtered results.`;

export async function filterResult(
  result: AnalysisResult,
  center: { lat: number; lng: number }
): Promise<AnalysisResult> {
  const ai = getAI();

  const userContent = `Please filter these vacant spaces identified near ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)} in Mumbai, India. Remove any inappropriate locations like water bodies, natural areas, or other unsuitable sites.

Original Analysis:
${JSON.stringify(result, null, 2)}

Return the filtered result in the EXACT same JSON format, keeping only suitable vacant spaces. If all spaces are inappropriate, return an empty vacantSpaces array but keep the original analysis and confidence.`;

  try {
    return await withRetry(
      async () => {
        const response = await ai.models.generateContent({
          model: MODELS.filter,
          config: {
            temperature: 0.2,
            systemInstruction: [{ text: FILTER_SYSTEM_INSTRUCTION }],
          },
          contents: [
            { role: 'user', parts: [{ text: userContent }] },
          ],
        });

        const content = response.text ?? '';
        if (!content.trim()) {
          throw new Error('Empty response from filter model');
        }
        return parseAnalysisResult(content, center);
      },
      `filter(${center.lat.toFixed(3)},${center.lng.toFixed(3)})`,
      { maxRetries: 3, baseDelayMs: 3000 }
    );
  } catch (error) {
    // Filter is non-critical — if it fails after all retries, return unfiltered
    console.warn(
      `[fallback] Filter failed after retries for ${center.lat.toFixed(4)},${center.lng.toFixed(4)}: ${error instanceof Error ? error.message : error}. Using unfiltered result.`
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

  let raw: any;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Malformed JSON in response: ${(e as Error).message}`);
  }

  const vacantSpaces: VacantSpaceResearch[] = (raw.vacantSpaces || []).map(
    (space: any, index: number) => ({
      location: space.location || `Site ${index + 1}`,
      coordinates: space.coordinates || {
        lat: center.lat + (Math.random() - 0.5) * 0.01,
        lng: center.lng + (Math.random() - 0.5) * 0.01,
      },
      suitability: Math.min(100, Math.max(0, space.suitability || 75)),
      recommendedTypes: Array.isArray(space.recommendedTypes)
        ? space.recommendedTypes
        : [],
      reasons: Array.isArray(space.reasons) ? space.reasons : ['Suitable location identified'],
      considerations: Array.isArray(space.considerations)
        ? space.considerations
        : ['Further analysis recommended'],
      description: space.description || 'Potential development site',
    })
  );

  return {
    vacantSpaces,
    analysis: raw.analysis || 'Analysis completed',
    confidence: Math.min(100, Math.max(0, raw.confidence || 80)),
  };
}
