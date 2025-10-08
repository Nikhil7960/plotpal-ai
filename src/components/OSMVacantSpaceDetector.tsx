import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, MapPin, Camera, Building2, Trees, Coffee, ShoppingBag, Home, Hospital, GraduationCap, Dumbbell, Utensils, Building } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { analyzeVacantSpaceWithQwenVL, geocodeLocation, type VacantSpace, type AnalysisResult } from '@/services/qwenVL';
import OSMMap from './OSMMap';
import L from 'leaflet';

const BUILDING_TYPES = [
  { value: 'cafe', label: 'Cafe', icon: Coffee },
  { value: 'mall', label: 'Shopping Mall', icon: ShoppingBag },
  { value: 'park', label: 'Park', icon: Trees },
  { value: 'residential', label: 'Residential Complex', icon: Home },
  { value: 'office', label: 'Office Building', icon: Building2 },
  { value: 'hospital', label: 'Hospital', icon: Hospital },
  { value: 'school', label: 'School', icon: GraduationCap },
  { value: 'gym', label: 'Gym/Fitness Center', icon: Dumbbell },
  { value: 'restaurant', label: 'Restaurant', icon: Utensils },
  { value: 'hotel', label: 'Hotel', icon: Building },
  { value: 'retail', label: 'Retail Store', icon: ShoppingBag },
];

interface OSMVacantSpaceDetectorProps {
  initialLocation?: string;
}

export default function OSMVacantSpaceDetector({ initialLocation = 'New York City' }: OSMVacantSpaceDetectorProps) {
  const { toast } = useToast();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  const [location, setLocation] = useState(initialLocation);
  const [buildingType, setBuildingType] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7128, -74.0060]); // NYC default
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [markers, setMarkers] = useState<Array<{ position: [number, number]; title: string; description?: string }>>([]);

  // Initialize map with NYC on first load
  useEffect(() => {
    const initializeLocation = async () => {
      const coords = await geocodeLocation(location);
      if (coords) {
        const newCenter: [number, number] = [coords.lat, coords.lng];
        setMapCenter(newCenter);
        if (mapRef.current) {
          mapRef.current.setView(newCenter, 15);
        }
      }
    };
    initializeLocation();
  }, []); // Only run once on mount

  const captureMapScreenshot = useCallback(async (): Promise<string> => {
    if (!mapContainerRef.current) {
      throw new Error('Map container not found');
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        scale: 1,
      });
      
      const dataUrl = canvas.toDataURL('image/png', 0.8);
      return dataUrl.split(',')[1];
    } catch (error) {
      console.error('Screenshot error:', error);
      throw new Error('Failed to capture map screenshot');
    }
  }, []);

  const analyzeVacantSpaces = useCallback(async () => {
    if (!buildingType) {
      toast({
        title: "Error",
        description: "Please select what to build",
        variant: "destructive",
      });
      return;
    }

    if (!location) {
      toast({
        title: "Error",
        description: "Please enter and search for a location first",
        variant: "destructive",
      });
      return;
    }

    if (!import.meta.env.VITE_OPENROUTER_API_KEY) {
      toast({
        title: "Configuration Error",
        description: "OpenRouter API key not configured. Please add VITE_OPENROUTER_API_KEY to your environment variables.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setMarkers([]);

    try {
      toast({
        title: "Capturing Map",
        description: "Taking screenshot of the current map view...",
      });
      
      const screenshotBase64 = await captureMapScreenshot();
      
      toast({
        title: "Analyzing with AI",
        description: "Qwen-VL is analyzing the map for vacant spaces...",
      });
      
      const result = await analyzeVacantSpaceWithQwenVL(
        screenshotBase64,
        buildingType,
        location,
        { lat: mapCenter[0], lng: mapCenter[1] }
      );
      
      setAnalysisResult(result);
      
      // Create markers for vacant spaces
      if (result.vacantSpaces && result.vacantSpaces.length > 0) {
        const newMarkers = result.vacantSpaces.map(space => ({
          position: [space.coordinates.lat, space.coordinates.lng] as [number, number],
          title: space.location,
          description: `${space.suitability}% suitable - ${space.description}`
        }));
        setMarkers(newMarkers);
        
        toast({
          title: "Analysis Complete",
          description: `Found ${result.vacantSpaces.length} potential locations with ${result.confidence}% confidence`,
        });
      } else {
        toast({
          title: "No Suitable Locations",
          description: "Could not identify suitable vacant spaces in this area. Try a different location or zoom level.",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze vacant spaces",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [buildingType, location, mapCenter, captureMapScreenshot, toast]);

  const BuildingIcon = buildingType ? 
    BUILDING_TYPES.find(t => t.value === buildingType)?.icon || Building2 : 
    Building2;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Open Source Vacant Space Detector
          </CardTitle>
          <CardDescription>
            Analyzing {location} with OpenStreetMap and Qwen-VL to find the best vacant spaces
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-50">
            <div className="space-y-2">
              <Label htmlFor="building-type">What to Build</Label>
              <Select value={buildingType} onValueChange={setBuildingType}>
                <SelectTrigger id="building-type" className="bg-background">
                  <SelectValue placeholder="Select building type" />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  {BUILDING_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={analyzeVacantSpaces}
                disabled={isAnalyzing || !buildingType || !location}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Analyze with AI
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Map Section */}
          <div ref={mapContainerRef} className="relative z-10">
            <OSMMap
              center={mapCenter}
              zoom={15}
              markers={markers}
              onMapReady={(map) => {
                mapRef.current = map;
              }}
              showControls={true}
            />
          </div>

          {/* Analysis Progress */}
          {isAnalyzing && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Qwen-VL is analyzing the map image to identify vacant spaces suitable for your {buildingType}...
              </AlertDescription>
            </Alert>
          )}

          {/* Results Section */}
          {analysisResult && analysisResult.vacantSpaces.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BuildingIcon className="h-5 w-5" />
                  AI-Recommended Vacant Spaces for {BUILDING_TYPES.find(t => t.value === buildingType)?.label}
                </h3>
                <div className="text-sm text-muted-foreground">
                  Confidence: {analysisResult.confidence}%
                </div>
              </div>
              
              <div className="grid gap-4">
                {analysisResult.vacantSpaces.map((space, index) => (
                  <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                        onClick={() => {
                          if (mapRef.current) {
                            mapRef.current.setView([space.coordinates.lat, space.coordinates.lng], 18);
                          }
                        }}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{space.location}</h4>
                            <p className="text-sm text-muted-foreground">
                              {space.coordinates.lat.toFixed(6)}, {space.coordinates.lng.toFixed(6)}
                            </p>
                            <p className="text-sm mt-1 text-foreground">{space.description}</p>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-2xl font-bold text-green-600">
                              {space.suitability}%
                            </div>
                            <p className="text-xs text-muted-foreground">Suitability</p>
                          </div>
                        </div>
                        
                        {space.reasons.length > 0 && (
                          <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-md">
                            <p className="text-sm font-medium mb-2 text-green-700 dark:text-green-400">
                              ✓ Why this location:
                            </p>
                            <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                              {space.reasons.map((reason, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-green-500 mt-0.5">•</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {space.considerations.length > 0 && (
                          <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-md">
                            <p className="text-sm font-medium mb-2 text-orange-700 dark:text-orange-400">
                              ⚠ Considerations:
                            </p>
                            <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                              {space.considerations.map((consideration, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-orange-500 mt-0.5">•</span>
                                  <span>{consideration}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis Text */}
          {analysisResult?.analysis && (
            <Alert>
              <AlertDescription className="whitespace-pre-wrap text-sm">
                <strong>AI Analysis:</strong><br />
                {analysisResult.analysis}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
