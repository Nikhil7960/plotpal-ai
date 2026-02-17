// Test utility to verify vacant-space filtering (Groq) works correctly
import { filterVacantSpacesWithGemini } from '../services/geminiFilter';
import { AnalysisResult } from '../services/qwenVL';

// Mock data with inappropriate locations (water bodies, etc.)
const mockQwenResult: AnalysisResult = {
  vacantSpaces: [
    {
      location: "Large empty lot near downtown",
      coordinates: { lat: 40.7128, lng: -74.0060 },
      suitability: 85,
      reasons: ["Large open space", "Good accessibility", "Urban location"],
      considerations: ["Zoning requirements", "Infrastructure needs"],
      description: "A suitable urban lot for development"
    },
    {
      location: "Hudson River waterfront area",
      coordinates: { lat: 40.7589, lng: -74.0278 },
      suitability: 70,
      reasons: ["Scenic location", "Large area"],
      considerations: ["Water access", "Environmental regulations"],
      description: "Waterfront area with development potential"
    },
    {
      location: "Central Park lake area",
      coordinates: { lat: 40.7829, lng: -73.9654 },
      suitability: 60,
      reasons: ["Central location", "High visibility"],
      considerations: ["Protected area", "Environmental impact"],
      description: "Lake area in Central Park"
    }
  ],
  analysis: "Found multiple potential locations with varying suitability scores",
  confidence: 75
};

export async function testGeminiFilter() {
  console.log('Testing Groq filtering...');
  console.log('Original results:', mockQwenResult.vacantSpaces.length, 'spaces');
  
  try {
    const filteredResult = await filterVacantSpacesWithGemini(
      mockQwenResult,
      'cafe',
      'New York City'
    );
    
    console.log('Filtered results:', filteredResult.vacantSpaces.length, 'spaces');
    console.log('Filtered spaces:', filteredResult.vacantSpaces.map(s => s.location));
    
    return filteredResult;
  } catch (error) {
    console.error('Test failed:', error);
    return null;
  }
}

// Uncomment to run test (requires VITE_GROQ_API_KEY)
// testGeminiFilter();
