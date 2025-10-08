export interface VacantSpace {
  location: string;
  coordinates: { lat: number; lng: number };
  suitability: number;
  reasons: string[];
  considerations: string[];
  description: string;
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
  mapCenter: { lat: number; lng: number }
): Promise<AnalysisResult> {
  try {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const buildingDescription = BUILDING_CONTEXT[buildingType as keyof typeof BUILDING_CONTEXT] || buildingType;
    
    const prompt = `You are an expert urban planner analyzing satellite imagery to identify vacant or underutilized spaces suitable for building ${buildingDescription}.

Location: ${location}
Map Center: ${mapCenter.lat.toFixed(6)}, ${mapCenter.lng.toFixed(6)}
Building Type: ${buildingType}

Analyze this satellite image and identify 2-4 BEST vacant spaces for development. Consider:
1. Empty lots and undeveloped land
2. Large parking areas that could be repurposed
3. Abandoned or underutilized buildings
4. Infrastructure and accessibility
5. Surrounding context and zoning

Return ONLY valid JSON in this EXACT format:
{
  "vacantSpaces": [
    {
      "location": "Descriptive location using visible landmarks",
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'PlotPal AI',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen2.5-vl-72b-instruct:free',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the response
    let result: AnalysisResult;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response');
      }
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
    console.error('Error analyzing with Qwen-VL:', error);
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
