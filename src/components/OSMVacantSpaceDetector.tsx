import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Loader2, MapPin, Camera, Building2, Trees, Coffee, ShoppingBag, Home, Hospital, GraduationCap, Dumbbell, Utensils, Building, Download, FileText, FileJson, Filter, MapPinned } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { analyzeVacantSpaceWithQwenVL, geocodeLocation, type VacantSpace, type AnalysisResult } from '@/services/qwenVL';
import { exportAnalysisAsJSON, exportAnalysisAsText } from '@/utils/export';
import { fetchNearbyPOIs, type POICategory } from '@/utils/osmPOI';
import { leafletBoundsToExtent, buildArcGISViewerUrl, centerZoomToExtent } from '@/utils/mergemapSync';
import { MapSkeleton, AnalysisProgress } from './LoadingStates';
import OSMMap from './OSMMap';
import ArcGISPropertyLookupIframe from './ArcGISPropertyLookupIframe';
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
  const [analysisStage, setAnalysisStage] = useState<'capturing' | 'analyzing' | 'processing'>('capturing');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [markers, setMarkers] = useState<Array<{ position: [number, number]; title: string; description?: string }>>([]);
  const [nearbyPOIs, setNearbyPOIs] = useState<POICategory[]>([]);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);
  const [minSuitability, setMinSuitability] = useState(0);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [arcgisUrl, setArcgisUrl] = useState(() =>
    buildArcGISViewerUrl({ extent: centerZoomToExtent([40.7128, -74.0060], 15) })
  );
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const skipNextMoveend = useRef(true);

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

  // Keep ArcGIS iframe URL in sync when mapCenter changes (e.g. after geocode)
  useEffect(() => {
    setArcgisUrl(buildArcGISViewerUrl({ extent: centerZoomToExtent(mapCenter, 15) }));
  }, [mapCenter]);

  const syncToArcgis = useCallback(() => {
    if (skipNextMoveend.current) {
      skipNextMoveend.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const extent = leafletBoundsToExtent(bounds);
    setArcgisUrl(buildArcGISViewerUrl({ extent }));
  }, []);

  useEffect(() => {
    return () => {
      mapRef.current?.off('moveend', syncToArcgis);
    };
  }, [syncToArcgis]);

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
    setMarkers([]);
    setNearbyPOIs([]);

    try {
      // Stage 1: Capture
      setAnalysisStage('capturing');
      const screenshotBase64 = await captureMapScreenshot();
      
      // Stage 2: Analyze
      setAnalysisStage('analyzing');
      const result = await analyzeVacantSpaceWithQwenVL(
        screenshotBase64,
        buildingType,
        location,
        { lat: mapCenter[0], lng: mapCenter[1] }
      );
      
      // Stage 3: Process and fetch POIs
      setAnalysisStage('processing');
      setAnalysisResult(result);
      
      // Create markers for vacant spaces
      if (result.vacantSpaces && result.vacantSpaces.length > 0) {
        const newMarkers = result.vacantSpaces.map(space => ({
          position: [space.coordinates.lat, space.coordinates.lng] as [number, number],
          title: space.location,
          description: `${space.suitability}% suitable - ${space.description}`
        }));
        setMarkers(newMarkers);
        
        // Fetch nearby POIs for the first result
        setIsLoadingPOIs(true);
        const pois = await fetchNearbyPOIs(
          result.vacantSpaces[0].coordinates.lat,
          result.vacantSpaces[0].coordinates.lng,
          500
        );
        setNearbyPOIs(pois);
        setIsLoadingPOIs(false);
        
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
            Analyzing {location} with OpenStreetMap and AI vision to find the best vacant spaces
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
                const extent = leafletBoundsToExtent(map.getBounds());
                setArcgisUrl(buildArcGISViewerUrl({ extent }));
                map.on('moveend', syncToArcgis);
                map.invalidateSize();
              }}
              showControls={true}
            />
          </div>

          {/* ArcGIS Property Lookup – synced with map above (same implementation as /mergemap) */}
          <div className="min-h-[400px] lg:min-h-0 flex flex-col space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              ArcGIS Property Lookup (Mumbai)
            </h2>
            <ArcGISPropertyLookupIframe
              src={arcgisUrl}
              isLoading={isIframeLoading}
              onLoad={() => setIsIframeLoading(false)}
            />
          </div>

          {/* Analysis Progress */}
          {isAnalyzing && <AnalysisProgress stage={analysisStage} />}

          {/* Results Section */}
          {analysisResult && analysisResult.vacantSpaces.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BuildingIcon className="h-5 w-5" />
                  AI-Recommended Vacant Spaces for {BUILDING_TYPES.find(t => t.value === buildingType)?.label}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    Confidence: {analysisResult.confidence}%
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportAnalysisAsJSON(location, buildingType, analysisResult)}
                  >
                    <FileJson className="h-4 w-4 mr-1" />
                    JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportAnalysisAsText(location, buildingType, analysisResult)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Text
                  </Button>
                </div>
              </div>
              
              {/* Filter Controls */}
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filter by Suitability Score
                      </Label>
                      <span className="text-sm font-medium">{minSuitability}%+</span>
                    </div>
                    <Slider
                      value={[minSuitability]}
                      onValueChange={(value) => setMinSuitability(value[0])}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Showing {analysisResult.vacantSpaces.filter(s => s.suitability >= minSuitability).length} of {analysisResult.vacantSpaces.length} locations
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <div className="grid gap-4">
                {analysisResult.vacantSpaces
                  .filter(space => space.suitability >= minSuitability)
                  .map((space, index) => (
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

          {/* Nearby POIs */}
          {nearbyPOIs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPinned className="h-5 w-5" />
                  Nearby Amenities (Top Location)
                </CardTitle>
                <CardDescription>
                  Within 500m of the top-rated vacant space
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPOIs ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading nearby amenities...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nearbyPOIs.map((category, idx) => (
                      <Card key={idx} className="bg-muted/30">
                        <CardContent className="pt-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm">{category.category}</h4>
                              <Badge variant="outline">{category.count}</Badge>
                            </div>
                            <ul className="text-xs space-y-1">
                              {category.items.slice(0, 3).map((poi, i) => (
                                <li key={i} className="flex items-center justify-between text-muted-foreground">
                                  <span className="truncate">{poi.name}</span>
                                  <span className="ml-2 text-xs">{poi.distance}m</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
