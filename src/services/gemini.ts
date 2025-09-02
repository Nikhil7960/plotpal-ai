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
    const prompt = `You are an expert urban planner and real estate developer with 20+ years of experience in site selection and development. Analyze this satellite/map image to identify the BEST vacant or underutilized spaces suitable for building ${buildingDescription}.

Location Context:
- Area: ${location}
- Map Center: ${mapCenter.lat.toFixed(6)}, ${mapCenter.lng.toFixed(6)}
- Building Type: ${buildingType.toUpperCase()} (${buildingDescription})

Critical Analysis Requirements:

1. VACANT SPACE IDENTIFICATION:
   - Look for empty lots, undeveloped land, large parking areas
   - Identify old/abandoned buildings suitable for demolition/redevelopment
   - Find underutilized spaces (oversized parking, vacant industrial areas)
   - Assess lot sizes and shapes for development viability

2. INFRASTRUCTURE & ACCESSIBILITY ANALYSIS:
   - Road connectivity and traffic patterns
   - Public transportation access
   - Utility infrastructure visibility
   - Emergency services accessibility
   - Pedestrian and vehicle access points

3. MARKET & DEMOGRAPHIC CONSIDERATIONS:
   - Population density in surrounding areas
   - Existing business types and competition
   - Residential vs commercial mix
   - Economic indicators from visible development quality
   - Target customer accessibility

4. REGULATORY & ENVIRONMENTAL FACTORS:
   - Apparent zoning compatibility (residential/commercial/mixed-use areas)
   - Environmental considerations (flood plains, slopes, green spaces)
   - Proximity to sensitive areas (schools, hospitals, residential)
   - Development constraints (powerlines, water bodies, protected areas)

5. BUILDING-SPECIFIC REQUIREMENTS for ${buildingType}:
   ${getBuildingSpecificConsiderations(buildingType)}

6. FINANCIAL VIABILITY INDICATORS:
   - Land acquisition feasibility (apparent lot ownership patterns)
   - Development cost factors (terrain, existing structures)
   - Revenue potential based on location and foot traffic
   - Competition analysis from visible businesses

PROVIDE DETAILED ANALYSIS in this EXACT JSON format:
{
  "vacantSpaces": [
    {
      "location": "Specific location description using visible landmarks and directional references",
      "coordinates": { "lat": estimated_latitude, "lng": estimated_longitude },
      "suitability": percentage_0_to_100,
      "reasons": [
        "Specific infrastructure advantage",
        "Market opportunity insight", 
        "Demographic benefit",
        "Accessibility advantage"
      ],
      "considerations": [
        "Specific regulatory challenge",
        "Environmental or zoning concern",
        "Market competition factor",
        "Development complexity"
      ],
      "description": "Comprehensive 2-3 sentence description of the space, its current state, size estimate, and development potential"
    }
  ],
  "analysis": "Detailed market analysis covering: 1) Overall area assessment for ${buildingType} development 2) Market demand indicators 3) Competition landscape 4) Development timeline recommendations 5) Key success factors for this location",
  "confidence": confidence_percentage_based_on_image_clarity_and_analysis_depth
}

IMPORTANT REQUIREMENTS:
- Identify 2-4 SPECIFIC, REALISTIC locations visible in the image
- Use visible landmarks (roads, buildings, features) for location descriptions
- Provide coordinates relative to map center with realistic offsets
- Give honest suitability scores (40-95% range, avoid perfect scores)
- Include both opportunities AND challenges
- Focus on actionable insights for developers
- Consider ${buildingType}-specific market demands and operational requirements
- Analyze actual visible features, don't make assumptions about off-screen areas

Quality Standards:
- Suitability scores should reflect genuine development potential
- Reasons must be specific to visible features and market analysis
- Considerations should include real development challenges
- Analysis should provide investment-grade insights`;

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
    cafe: `- Target 1,000-3,000 sq ft spaces with good street visibility
- High foot traffic areas: office districts, universities, residential neighborhoods
- Parking for 10-15 vehicles minimum
- Ground floor locations with large windows preferred
- Proximity to complementary businesses (bookstores, coworking spaces)
- Morning commute routes and lunch-hour accessibility
- Avoid industrial areas and low-density suburbs`,
    
    mall: `- Minimum 50,000-200,000 sq ft development area required
- Highway accessibility and major road intersections critical
- Population base of 100,000+ within 15-mile radius needed
- Existing retail infrastructure and competitive analysis
- Anchor tenant potential and customer parking (500+ spaces)
- Public transportation connections beneficial
- Avoid areas with declining economic indicators`,
    
    park: `- Minimum 2-5 acres for community park functionality
- Central location accessible to multiple residential areas
- Natural features: existing trees, water features, topography
- Connection to pedestrian/bike path networks
- Environmental considerations: drainage, soil quality
- Community demographics: family density, age distribution
- Avoid flood-prone areas and contaminated land`,
    
    residential: `- Quiet locations away from industrial and high-traffic areas
- Proximity to quality schools and their district ratings
- Public transportation access and commuter routes
- Community amenities: shopping, healthcare, recreation
- Utilities infrastructure capacity for development density
- Property values and neighborhood appreciation trends
- Zoning allows for intended residential density`,
    
    office: `- Business district proximity and professional environment
- Transportation hubs and commuter accessibility
- Parking ratios: 3-4 spaces per 1,000 sq ft office space
- Fiber optic and telecommunications infrastructure
- Proximity to business services, restaurants, hotels
- Economic development zones and business incentives
- Avoid residential-only and retail-dominated areas`,
    
    hospital: `- Large flat development area (10+ acres for full-service hospital)
- Multiple emergency vehicle access routes required
- Population density and healthcare service gaps analysis
- Proximity to medical professional offices and specialists
- Helicopter landing capability and flight path clearance
- Utilities capacity for high-demand medical equipment
- Avoid areas with noise restrictions and residential opposition`,
    
    school: `- Safe neighborhoods with low crime statistics
- Adequate space: 10+ acres for elementary, 20+ for secondary
- Transportation: bus routes and parent drop-off areas
- Residential family density and enrollment projections
- Distance from other schools to avoid overcrowding
- Environmental safety: away from industrial, high-traffic areas
- Community support and local education funding`,
    
    gym: `- Target demographics: young professionals, families
- Parking for 50-100 vehicles depending on facility size
- Ground floor access preferred, basement locations acceptable
- Proximity to residential areas within 10-minute drive
- Competition analysis: existing fitness facilities nearby
- Complementary businesses: health food, sports retail
- Avoid areas with declining demographics or oversaturation`,
    
    restaurant: `- High visibility locations with street-level access
- Dinner hour accessibility and weekend foot traffic
- Parking availability and valet service potential
- Alcohol service regulations and licensing requirements
- Competition density and cuisine type market gaps
- Demographics matching target customer base and spending power
- Delivery accessibility for food service platforms`,
    
    hotel: `- Transportation proximity: airports, highways, train stations
- Business district or tourist attraction accessibility
- Convention centers and corporate facilities nearby
- Market demand analysis: business vs leisure travel
- Competition from existing hotels and market saturation
- Infrastructure for large-scale hospitality operations
- Economic development and tourism growth indicators`,
    
    retail: `- High visibility and street-level customer access
- Demographics matching target customer income levels
- Foot traffic patterns and shopping behavior analysis
- Parking convenience and public transportation access
- Competition analysis and market positioning opportunities
- Seasonal traffic variations and economic stability
- Anchor businesses and shopping center synergies`
  };
  
  return considerations[buildingType as keyof typeof considerations] || 
    `- General site development considerations
- Infrastructure access and utility capacity
- Market demand analysis and competition assessment
- Community needs alignment and demographic fit
- Regulatory compliance and zoning requirements
- Environmental impact and sustainability factors`;
}
