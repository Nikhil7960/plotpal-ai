import { GoogleGenAI } from '@google/genai';
import { AnalysisResult } from './qwenVL';
import type { LocationContext } from './locationContext';
import { generateContentWithFallback } from './geminiRetry';

const SYSTEM_INSTRUCTION = `You are an urban planning quality checker. Your job is to review proposed development sites and remove only CLEARLY inappropriate ones.

BIAS: When in doubt, KEEP the space. Only remove a space if you are confident it is unsuitable.

REMOVE a space ONLY if:
- It is directly on top of a water body (river, lake, ocean — NOT just nearby)
- It is inside a military base
- It is on top of an active highway, railway track, or airport runway

DO NOT remove a space just because:
- The area has flood risk (most coastal cities have some flood risk)
- It is in a residential zone (vacant plots exist within residential areas)
- There is nearby infrastructure (proximity to roads is actually good)
- The broader area has environmental concerns (only reject if the SPECIFIC plot is unsuitable)
- There are parks or green spaces nearby (nearby is fine, only reject if the plot IS a park)

Return ONLY valid JSON in the requested format.`;

interface FilterDecision {
  keepIndices?: number[];
  removedReasons?: Record<string, string>;
  analysis?: string;
  confidence?: number;
}

export async function filterVacantSpacesWithGemini(
  qwenResult: AnalysisResult,
  buildingType: string,
  location: string,
  locationContext?: LocationContext
): Promise<AnalysisResult> {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('Gemini API key not configured, returning original results');
      return qwenResult;
    }

    if (!qwenResult.vacantSpaces || qwenResult.vacantSpaces.length === 0) {
      return qwenResult;
    }

    const ai = new GoogleGenAI({ apiKey });

    // Number spaces with stable indices for the filter to reference
    const numberedSpaces = qwenResult.vacantSpaces.map((s, i) =>
      `[${i}] "${s.location}" at (${s.coordinates.lat.toFixed(6)}, ${s.coordinates.lng.toFixed(6)}) — ${s.description}`
    ).join('\n');

    const contextSection = locationContext
      ? `\nOPENSTREETMAP DATA FOR THIS AREA:\n${locationContext.summary}\n`
      : '';

    const userContent = `Review these proposed vacant spaces for ${buildingType} development in ${location}.
${contextSection}
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

    const response = await generateContentWithFallback(ai, {
      config: {
        temperature: 0.2,
        systemInstruction: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }],
        },
      ],
    });

    const fullResponse = response.text ?? '';

    // Parse the filter decision
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON in filter response, keeping all spaces');
      return qwenResult;
    }

    let decision: FilterDecision;
    try {
      decision = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.warn('Failed to parse filter decision, keeping all spaces');
      return qwenResult;
    }

    // Validate keepIndices and use them to filter the ORIGINAL array
    // (preserves all original fields — no data loss from LLM hallucinating schemas)
    const validIndices = Array.isArray(decision.keepIndices)
      ? decision.keepIndices.filter(
          (i): i is number =>
            Number.isInteger(i) && i >= 0 && i < qwenResult.vacantSpaces.length
        )
      : qwenResult.vacantSpaces.map((_, i) => i);

    const filteredSpaces = validIndices.map(i => qwenResult.vacantSpaces[i]);

    if (decision.removedReasons && Object.keys(decision.removedReasons).length > 0) {
      console.log('Filter removed reasons:', decision.removedReasons);
    }

    return {
      vacantSpaces: filteredSpaces,
      analysis: decision.analysis || qwenResult.analysis,
      confidence: typeof decision.confidence === 'number'
        ? Math.min(100, Math.max(0, decision.confidence))
        : qwenResult.confidence,
    };
  } catch (error) {
    console.error('Error filtering with Gemini:', error);
    console.warn('Gemini filtering failed, returning original results');
    return qwenResult;
  }
}
