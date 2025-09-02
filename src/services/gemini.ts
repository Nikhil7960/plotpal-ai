import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// Building type descriptions for better context
const BUILDING_CONTEXT = {
  cafe: 'a coffee shop or cafe with seating area, kitchen facilities, and customer parking',
  mall: 'a large shopping mall with multiple stores, parking facilities, food courts, and entertainment areas',
  park: 'a public park with green spaces, walking paths, recreational facilities, and possibly playgrounds',
  residential: 'a residential complex with apartments or houses, parking, and community amenities',
  office: 'an office building for businesses with workspace, meeting rooms, and parking facilities',
  hospital: 'a medical facility with emergency services, patient rooms, parking, and medical equipment areas',
  school: 'an educational institution with classrooms, playground, sports facilities, and parking',
  gym: 'a fitness center with exercise equipment, changing rooms, and parking facilities',
  restaurant: 'a restaurant with dining area, kitchen, and customer parking',
  hotel: 'a hotel with guest rooms, lobby, restaurant, and parking facilities',
  retail: 'a retail store with customer area, storage, and parking'
};

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

export async function analyzeVacantSpaceWithGemini(
  imageBase64: string,
  buildingType: string,
  location: string,
  mapCenter: { lat: number; lng: number }
): Promise<AnalysisResult> {
  try {
    // Get the model with enhanced configuration
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096,
      },
    });

    // Get building description
    const buildingDescription = BUILDING_CONTEXT[buildingType as keyof typeof BUILDING_CONTEXT] || buildingType;
    
    // Create comprehensive prompt
    const prompt = `You are an expert urban planner and real estate developer with extensive knowledge in site selection and development. Analyze this satellite/map image to identify the BEST vacant or underutilized spaces suitable for building ${buildingDescription}.

Location Context:
- Area: ${location}
- Map Center: ${mapCenter.lat.toFixed(6)}, ${mapCenter.lng.toFixed(6)}
- Building Type: ${buildingType.toUpperCase()} (${buildingDescription})

Analysis Requirements:
1. Carefully examine the map image for:
   - Empty lots or vacant land
   - Underutilized areas (large parking lots, abandoned buildings)
   - Areas suitable for redevelopment
   - Proper size for the intended building type

2. Consider critical factors:
   - Accessibility and road connectivity
   - Proximity to target demographics
   - Available space size and shape
   - Surrounding infrastructure quality
   - Traffic accessibility
   - Nearby complementary businesses
   - Zoning compatibility (if visible)
   - Environmental factors

3. For ${buildingType} specifically consider:
   ${getBuildingSpecificConsiderations(buildingType)}

Please provide your analysis in this EXACT JSON format (no additional text):
{
  "vacantSpaces": [
    {
      "location": "Specific descriptive location based on visible landmarks",
      "coordinates": { "lat": estimated_latitude, "lng": estimated_longitude },
      "suitability": suitability_percentage_0_to_100,
      "reasons": ["specific reason 1", "specific reason 2", "specific reason 3"],
      "considerations": ["potential challenge 1", "consideration 2"],
      "description": "Detailed description of the vacant space and why it's suitable"
    }
  ],
  "analysis": "Overall analysis of the area for ${buildingType} development with market insights",
  "confidence": confidence_level_0_to_100
}

Requirements:
- Identify 2-4 most promising locations
- Be specific about locations using visible landmarks
- Estimate coordinates relative to the map center
- Provide realistic suitability scores
- Focus on practical development considerations
- Consider the specific needs of ${buildingType}`;

    // Prepare the image part
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/png',
      },
    };

    // Generate content
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log('Gemini Raw Response:', text);

    // Try to parse JSON from the response
    try {
      // Clean the response text - remove markdown code blocks if present
      let cleanedText = text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```\s*/, '').replace(/```\s*$/, '');
      }

      // Extract JSON from the response
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        
        // Validate and enhance the data
        if (jsonData.vacantSpaces && Array.isArray(jsonData.vacantSpaces)) {
          jsonData.vacantSpaces = jsonData.vacantSpaces.map((space: Partial<VacantSpace>, index: number) => ({
            location: space.location || `Potential Site ${index + 1}`,
            coordinates: space.coordinates || {
              lat: mapCenter.lat + (Math.random() - 0.5) * 0.01,
              lng: mapCenter.lng + (Math.random() - 0.5) * 0.01,
            },
            suitability: Math.min(100, Math.max(0, space.suitability || 75)),
            reasons: Array.isArray(space.reasons) ? space.reasons : ['AI identified this as a suitable location'],
            considerations: Array.isArray(space.considerations) ? space.considerations : ['Further analysis recommended'],
            description: space.description || 'Vacant space identified for development'
          }));
        }
        
        return {
          vacantSpaces: jsonData.vacantSpaces || [],
          analysis: jsonData.analysis || text,
          confidence: Math.min(100, Math.max(0, jsonData.confidence || 70))
        };
      }
    } catch (parseError) {
      console.error('Error parsing JSON from Gemini response:', parseError);
      console.log('Response text:', text);
    }

    // Fallback response if JSON parsing fails
    return {
      vacantSpaces: [],
      analysis: text,
      confidence: 50
    };
    
  } catch (error) {
    console.error('Error analyzing with Gemini:', error);
    throw new Error(`Failed to analyze vacant spaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getBuildingSpecificConsiderations(buildingType: string): string {
  const considerations = {
    cafe: '- High foot traffic areas\n- Proximity to offices, schools, or residential areas\n- Parking availability\n- Visibility from street',
    mall: '- Large open spaces (minimum 5-10 acres)\n- Highway accessibility\n- Population density\n- Existing retail infrastructure',
    park: '- Open green spaces\n- Community accessibility\n- Environmental considerations\n- Connection to residential areas',
    residential: '- Quiet areas away from industrial zones\n- School districts\n- Public transportation\n- Community amenities nearby',
    office: '- Business district proximity\n- Transportation hubs\n- Parking facilities\n- Professional environment',
    hospital: '- Emergency vehicle access\n- Large flat areas\n- Population density\n- Existing medical facilities',
    school: '- Safe neighborhoods\n- Adequate space for buildings and playgrounds\n- Transportation accessibility\n- Residential area proximity',
    gym: '- Residential or commercial areas\n- Parking availability\n- Ground floor access\n- Complementary businesses nearby'
  };
  
  return considerations[buildingType as keyof typeof considerations] || '- General development considerations\n- Infrastructure access\n- Community needs\n- Environmental factors';
}
