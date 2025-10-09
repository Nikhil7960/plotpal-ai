import { GoogleGenAI } from '@google/genai';
import { VacantSpace, AnalysisResult } from './qwenVL';

export async function filterVacantSpacesWithGemini(
  qwenResult: AnalysisResult,
  buildingType: string,
  location: string
): Promise<AnalysisResult> {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('Gemini API key not configured, returning original results');
      return qwenResult;
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
    });

    const config = {
      temperature: 0.2,
      systemInstruction: [
        {
          text: `You are an expert urban planning validator. Your job is to filter out inappropriate vacant spaces that are NOT suitable for building development.

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

Return ONLY valid JSON with filtered results.`,
        }
      ],
    };

    const model = 'gemini-2.5-pro';
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `Please filter these vacant spaces for ${buildingType} development in ${location}. Remove any inappropriate locations like water bodies, natural areas, or other unsuitable sites.

Original Analysis:
${JSON.stringify(qwenResult, null, 2)}

Return the filtered result in the EXACT same JSON format, keeping only suitable vacant spaces. If all spaces are inappropriate, return an empty vacantSpaces array but keep the original analysis and confidence.`,
          },
        ],
      },
    ];

    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let fullResponse = '';
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
      }
    }

    // Parse the filtered response
    let filteredResult: AnalysisResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        filteredResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('Failed to parse Gemini filter response, returning original results');
      return qwenResult;
    }

    // Validate the filtered result structure
    if (!filteredResult.vacantSpaces || !Array.isArray(filteredResult.vacantSpaces)) {
      console.warn('Invalid filtered result structure, returning original results');
      return qwenResult;
    }

    // Ensure filtered spaces maintain required properties
    const validatedSpaces = filteredResult.vacantSpaces.map((space: VacantSpace) => ({
      location: space.location || 'Filtered location',
      coordinates: space.coordinates || { lat: 0, lng: 0 },
      suitability: Math.min(100, Math.max(0, space.suitability || 0)),
      reasons: Array.isArray(space.reasons) ? space.reasons : [],
      considerations: Array.isArray(space.considerations) ? space.considerations : [],
      description: space.description || 'Validated vacant space'
    }));

    return {
      vacantSpaces: validatedSpaces,
      analysis: filteredResult.analysis || qwenResult.analysis,
      confidence: Math.min(100, Math.max(0, filteredResult.confidence || qwenResult.confidence))
    };

  } catch (error) {
    console.error('Error filtering with Gemini:', error);
    console.warn('Gemini filtering failed, returning original results');
    return qwenResult;
  }
}
