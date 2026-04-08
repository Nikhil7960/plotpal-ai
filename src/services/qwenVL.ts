import { GoogleGenAI } from '@google/genai';
import type { LocationContext } from './locationContext';

export interface VacantSpace {
  location: string;
  coordinates: { lat: number; lng: number };
  suitability: number;
  reasons: string[];
  considerations: string[];
  description: string;
  validationStatus?: 'verified' | 'unverified';
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
  propertyMapBase64?: string
): Promise<AnalysisResult> {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    const buildingDescription = BUILDING_CONTEXT[buildingType as keyof typeof BUILDING_CONTEXT] || buildingType;

    // Build the ground truth section if location context is available
    const groundTruthSection = locationContext
      ? `\n== AREA CONTEXT (from OpenStreetMap) ==\n${locationContext.summary}\n`
      : '';

    const propertyMapNote = propertyMapBase64
      ? '\nA second image is provided showing property/zoning map overlay for this area. Use it to identify zones marked for development or vacant parcels.\n'
      : '';

    const prompt = `You are an expert urban planner analyzing satellite imagery to identify vacant or underutilized spaces suitable for building ${buildingDescription}.

Location: ${location}
Map Center: ${mapCenter.lat.toFixed(6)}, ${mapCenter.lng.toFixed(6)}
Building Type: ${buildingType}
${groundTruthSection}${propertyMapNote}
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

    // Build content parts: prompt + satellite image + optional property map
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt },
      { inlineData: { mimeType: 'image/png', data: imageBase64 } },
    ];

    if (propertyMapBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: propertyMapBase64 } });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        temperature: 0.3,
      },
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
    });

    const content = response.text ?? '';

    // Parse the response
    let result: AnalysisResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      throw new Error('Failed to parse AI response');
    }

    // Validate and enhance the result
    if (result.vacantSpaces && Array.isArray(result.vacantSpaces)) {
      result.vacantSpaces = result.vacantSpaces.map((space, index) => ({
        location: space.location || `Site ${index + 1}`,
        coordinates: space.coordinates || {
          lat: mapCenter.lat + (Math.random() - 0.5) * 0.01,
          lng: mapCenter.lng + (Math.random() - 0.5) * 0.01,
        },
        suitability: Math.min(100, Math.max(0, space.suitability || 75)),
        reasons: Array.isArray(space.reasons) ? space.reasons : ['Suitable location identified'],
        considerations: Array.isArray(space.considerations) ? space.considerations : ['Further analysis recommended'],
        description: space.description || 'Potential development site'
      }));
    }

    return {
      vacantSpaces: result.vacantSpaces || [],
      analysis: result.analysis || 'Analysis completed',
      confidence: Math.min(100, Math.max(0, result.confidence || 80))
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
