import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, MapPin, Camera, Building2, Trees, Coffee, ShoppingBag, Home, Hospital, GraduationCap, Dumbbell, Utensils, Building } from 'lucide-react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { analyzeVacantSpaceWithGemini, type VacantSpace, type AnalysisResult } from '@/services/gemini';

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

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const defaultCenter = {
  lat: 40.7128,
  lng: -74.0060,
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: true,
  mapTypeControl: true,
  fullscreenControl: true,
  mapTypeId: 'satellite' as google.maps.MapTypeId,
};

interface VacantSpaceDetectorProps {
  initialLocation?: string;
  initialCoordinates?: [number, number];
}

export default function VacantSpaceDetector({ 
  initialLocation = '', 
  initialCoordinates 
}: VacantSpaceDetectorProps) {
  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  const [location, setLocation] = useState(initialLocation);
  const [buildingType, setBuildingType] = useState('');
  const [mapCenter, setMapCenter] = useState(
    initialCoordinates 
      ? { lat: initialCoordinates[1], lng: initialCoordinates[0] }
      : defaultCenter
  );
  const [mapZoom, setMapZoom] = useState(15);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [mapScreenshot, setMapScreenshot] = useState<string>('');
  const [selectedMarker, setSelectedMarker] = useState<VacantSpace | null>(null);

  const handleLocationSearch = useCallback(async () => {
    if (!location) {
      toast({
        title: "Error",
        description: "Please enter a location",
        variant: "destructive",
      });
      return;
    }

    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address: location });
      
      if (result.results && result.results[0]) {
        const { lat, lng } = result.results[0].geometry.location;
        const newCenter = { lat: lat(), lng: lng() };
        setMapCenter(newCenter);
        setMapZoom(15);
        
        if (mapRef.current) {
          mapRef.current.panTo(newCenter);
          mapRef.current.setZoom(15);
        }
        
        toast({
          title: "Location Found",
          description: `Map centered on ${location}`,
        });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast({
        title: "Error",
        description: "Could not find the specified location",
        variant: "destructive",
      });
    }
  }, [location, toast]);

  const captureMapScreenshot = useCallback(async (): Promise<string> => {
    if (!mapContainerRef.current) {
      throw new Error('Map container not found');
    }

    try {
      // Wait for the map to fully render
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        scale: 1,
        width: mapContainerRef.current.offsetWidth,
        height: mapContainerRef.current.offsetHeight,
      });
      
      const dataUrl = canvas.toDataURL('image/png', 0.8);
      setMapScreenshot(dataUrl);
      return dataUrl.split(',')[1]; // Return base64 without prefix
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

    // Check if Gemini API key is configured
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      toast({
        title: "Configuration Error",
        description: "Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your environment variables.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setSelectedMarker(null);

    try {
      // Step 1: Capture map screenshot
      toast({
        title: "Capturing Map",
        description: "Taking screenshot of the current map view...",
      });
      
      const screenshotBase64 = await captureMapScreenshot();
      
      // Step 2: Analyze with Gemini AI
      toast({
        title: "Analyzing with AI",
        description: "Gemini AI is analyzing the map for vacant spaces...",
      });
      
      const result = await analyzeVacantSpaceWithGemini(
        screenshotBase64,
        buildingType,
        location,
        mapCenter
      );
      
      setAnalysisResult(result);
      
      if (result.vacantSpaces && result.vacantSpaces.length > 0) {
        toast({
          title: "Analysis Complete",
          description: `Found ${result.vacantSpaces.length} potential locations with ${result.confidence}% confidence`,
        });
      } else {
        toast({
          title: "No Suitable Locations",
          description: "AI couldn't identify suitable vacant spaces in this area. Try a different location or zoom level.",
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

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const BuildingIcon = buildingType ? 
    BUILDING_TYPES.find(t => t.value === buildingType)?.icon || Building2 : 
    Building2;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            AI Vacant Space Detector
          </CardTitle>
          <CardDescription>
            Use AI to find the best vacant spaces in your city for your development project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="flex gap-2">
                <Input
                  id="location"
                  placeholder="Enter city or address"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
                />
                <Button onClick={handleLocationSearch} size="sm">
                  <MapPin className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="building-type">What to Build</Label>
              <Select value={buildingType} onValueChange={setBuildingType}>
                <SelectTrigger id="building-type">
                  <SelectValue placeholder="Select building type" />
                </SelectTrigger>
                <SelectContent>
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
          <div ref={mapContainerRef} className="border rounded-lg overflow-hidden">
            <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={mapZoom}
                onLoad={onMapLoad}
                options={mapOptions}
                onZoomChanged={() => {
                  if (mapRef.current) {
                    setMapZoom(mapRef.current.getZoom() || 15);
                  }
                }}
              >
                {/* Show markers for vacant spaces */}
                {analysisResult?.vacantSpaces.map((space, index) => (
                  <Marker
                    key={index}
                    position={space.coordinates}
                    title={space.location}
                    onClick={() => setSelectedMarker(space)}
                    icon={{
                      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#10b981" stroke="#059669"></path>
                          <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
                        </svg>
                      `),
                      scaledSize: new google.maps.Size(40, 40),
                    }}
                  />
                ))}
                
                {/* Info Window for selected marker */}
                {selectedMarker && (
                  <InfoWindow
                    position={selectedMarker.coordinates}
                    onCloseClick={() => setSelectedMarker(null)}
                  >
                    <div className="p-2 max-w-sm">
                      <h3 className="font-semibold text-sm">{selectedMarker.location}</h3>
                      <p className="text-xs text-green-600 font-medium">
                        {selectedMarker.suitability}% Suitable
                      </p>
                      <p className="text-xs mt-1">{selectedMarker.description}</p>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </LoadScript>
          </div>

          {/* Analysis Progress */}
          {isAnalyzing && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                AI is analyzing the map image to identify vacant spaces suitable for your {buildingType}...
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
                  <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSelectedMarker(space);
                          if (mapRef.current) {
                            mapRef.current.panTo(space.coordinates);
                            mapRef.current.setZoom(18);
                          }
                        }}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold">{space.location}</h4>
                            <p className="text-sm text-muted-foreground">
                              {space.coordinates.lat.toFixed(6)}, {space.coordinates.lng.toFixed(6)}
                            </p>
                            <p className="text-sm mt-1">{space.description}</p>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-2xl font-bold text-green-600">
                              {space.suitability}%
                            </div>
                            <p className="text-xs text-muted-foreground">Suitability</p>
                          </div>
                        </div>
                        
                        {space.reasons.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1 text-green-700">✓ Why this location:</p>
                            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                              {space.reasons.map((reason, i) => (
                                <li key={i}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {space.considerations.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1 text-orange-700">⚠ Considerations:</p>
                            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                              {space.considerations.map((consideration, i) => (
                                <li key={i}>{consideration}</li>
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

          {/* Screenshot Preview (for debugging) */}
          {mapScreenshot && (
            <details className="space-y-2">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                View captured map screenshot (for debugging)
              </summary>
              <img 
                src={mapScreenshot} 
                alt="Map Screenshot" 
                className="w-full max-w-md rounded-lg border"
              />
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}