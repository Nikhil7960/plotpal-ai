import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Loader2, MapPin, Camera, Building2, Trees, Coffee, ShoppingBag, Home, Hospital, GraduationCap, Dumbbell, Utensils, Building, Download, FileText, FileJson, Filter, MapPinned, ShieldCheck, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { analyzeVacantSpaceWithQwenVL, geocodeLocation, type VacantSpace, type AnalysisResult } from '@/services/qwenVL';
import { filterVacantSpacesWithGemini } from '@/services/geminiFilter';
import { fetchLocationContext, reverseGeocode, validateAllCoordinates } from '@/services/locationContext';
import { auditVacantSpaces } from '@/services/visualAudit';
import type { ImageBounds, ImageSize } from '@/services/imageCoords';
import { exportAnalysisAsJSON, exportAnalysisAsText } from '@/utils/export';
import { fetchNearbyPOIs, type POICategory } from '@/utils/osmPOI';
import { centerZoomToExtent, fetchArcGISMapExport } from '@/utils/mergemapSync';
import { attachArcGISParcelOverlay, type ArcGISParcelOverlayHandle, type ParcelStatus } from '@/utils/arcgisParcels';
import { createPlan } from '@/services/buildPlan/planStore';
import type { InfraType } from '@/services/buildPlan/types';
import { AnalysisProgress, type AnalysisStage } from './LoadingStates';
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

function ParcelOverlayStatus({
  show,
  status,
  onToggle,
}: {
  show: boolean;
  status: ParcelStatus;
  onToggle: (next: boolean) => void;
}) {
  let label = '';
  let tone = 'text-muted-foreground';
  switch (status.kind) {
    case 'idle':
      label = show ? 'Property overlay ready' : 'Property overlay hidden';
      break;
    case 'loading':
      label = 'Loading property parcels…';
      break;
    case 'hidden-zoom':
      label = `Zoom in to level ${status.minZoom}+ to see property parcels`;
      tone = 'text-amber-600 dark:text-amber-400';
      break;
    case 'hidden-area':
      label = 'Zoom in further — area too wide to fetch parcels';
      tone = 'text-amber-600 dark:text-amber-400';
      break;
    case 'ready':
      label = `Showing ${status.landParcels} parcels, ${status.finalPlots} final plots`;
      tone = 'text-green-600 dark:text-green-400';
      break;
    case 'error':
      label = `Parcel load failed: ${status.message}`;
      tone = 'text-red-600 dark:text-red-400';
      break;
  }
  return (
    <div className="absolute left-3 bottom-3 z-[1000] flex items-center gap-2 rounded-md bg-background/90 backdrop-blur px-2.5 py-1.5 shadow border text-xs">
      <Button
        size="sm"
        variant={show ? 'default' : 'outline'}
        className="h-7 px-2"
        onClick={() => onToggle(!show)}
      >
        {show ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
        Property overlay
      </Button>
      {show && <span className={tone}>{label}</span>}
    </div>
  );
}

export default function OSMVacantSpaceDetector({ initialLocation = 'New York City' }: OSMVacantSpaceDetectorProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const parcelOverlayRef = useRef<ArcGISParcelOverlayHandle | null>(null);

  const [location, setLocation] = useState(initialLocation);
  const [buildingType, setBuildingType] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([19.076, 72.8777]); // Mumbai default
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>('capturing');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [markers, setMarkers] = useState<Array<{ position: [number, number]; title: string; description?: string }>>([]);
  const [nearbyPOIs, setNearbyPOIs] = useState<POICategory[]>([]);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);
  const [minSuitability, setMinSuitability] = useState(0);
  const [showParcels, setShowParcels] = useState(true);
  const [parcelStatus, setParcelStatus] = useState<ParcelStatus>({ kind: 'idle' });

  // Initialize map with geocoded location on first load
  useEffect(() => {
    const initializeLocation = async () => {
      const coords = await geocodeLocation(location);
      if (coords) {
        const newCenter: [number, number] = [coords.lat, coords.lng];
        setMapCenter(newCenter);
      }
    };
    initializeLocation();
  }, []); // Only run once on mount

  // When mapCenter updates (after geocoding or prop change), recenter the map.
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(mapCenter, 17);
    }
  }, [mapCenter]);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    parcelOverlayRef.current?.destroy();
    parcelOverlayRef.current = attachArcGISParcelOverlay({
      map,
      minZoom: 15,
      onStatusChange: setParcelStatus,
    });
    map.invalidateSize();
  }, []);

  const handleToggleParcels = useCallback((next: boolean) => {
    setShowParcels(next);
    parcelOverlayRef.current?.setVisible(next);
  }, []);

  useEffect(() => {
    return () => {
      parcelOverlayRef.current?.destroy();
    };
  }, []);

  const captureMapScreenshot = useCallback(async (): Promise<{
    base64: string;
    bounds: ImageBounds;
    size: ImageSize;
  }> => {
    if (!mapContainerRef.current || !mapRef.current) {
      throw new Error('Map container not ready');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const canvas = await html2canvas(mapContainerRef.current, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      scale: 1,
    });

    const dataUrl = canvas.toDataURL('image/png', 0.8);
    const base64 = dataUrl.split(',')[1];

    const mapBounds = mapRef.current.getBounds();
    const bounds: ImageBounds = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest(),
    };
    const size: ImageSize = { width: canvas.width, height: canvas.height };
    return { base64, bounds, size };
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
      // Stage 1: Capture map screenshot
      setAnalysisStage('capturing');
      const { base64: screenshotBase64, bounds: imageBounds, size: imageSize } = await captureMapScreenshot();

      // Stage 2: Gather location context + reverse geocode + property map (in parallel)
      setAnalysisStage('context');
      const currentMap = mapRef.current;
      const currentBounds = currentMap?.getBounds();
      const currentCenter: [number, number] = currentMap
        ? [currentMap.getCenter().lat, currentMap.getCenter().lng]
        : mapCenter;
      const propertyExtent = currentBounds
        ? [
            currentBounds.getWest(),
            currentBounds.getSouth(),
            currentBounds.getEast(),
            currentBounds.getNorth(),
          ]
            .map((n) => n.toFixed(6))
            .join(',')
        : centerZoomToExtent(currentCenter, 17);
      const [locationContext, actualLocation, propertyMapBase64] = await Promise.all([
        fetchLocationContext(currentCenter[0], currentCenter[1], 1000),
        reverseGeocode(currentCenter[0], currentCenter[1]),
        fetchArcGISMapExport(propertyExtent).catch(() => null),
      ]);

      // Use reverse-geocoded location instead of stale search term
      const analysisLocation = actualLocation || location;
      console.log('Actual location (reverse geocoded):', analysisLocation);
      console.log('Location context:', locationContext.summary);
      console.log('Property map available:', !!propertyMapBase64);

      // Stage 3: AI Analysis (pixel-based coords, converted to lat/lng in code)
      setAnalysisStage('analyzing');
      const rawResult = await analyzeVacantSpaceWithQwenVL(
        screenshotBase64,
        buildingType,
        analysisLocation,
        { lat: mapCenter[0], lng: mapCenter[1] },
        locationContext,
        propertyMapBase64 || undefined,
        imageBounds,
        imageSize,
      );
      console.log(`AI found ${rawResult.vacantSpaces.length} candidate spaces`);

      // Stage 4: Gemini filter — drop hard blockers (water, military, transport)
      setAnalysisStage('filtering');
      const filteredResult = await filterVacantSpacesWithGemini(
        rawResult, buildingType, analysisLocation, locationContext
      );
      console.log(`After filter: ${filteredResult.vacantSpaces.length} spaces remain`);

      // Stage 4.5: Visual audit — re-inspect the image and drop spaces that
      // don't actually land on vacant pixels. This is the main quality gate.
      setAnalysisStage('auditing');
      const { kept: auditedSpaces, audits } = await auditVacantSpaces(
        filteredResult.vacantSpaces, screenshotBase64, imageBounds, imageSize
      );
      console.log(`After visual audit: ${auditedSpaces.length} spaces remain`, audits);

      // Stage 5: Hard programmatic validation via Overpass is_in
      setAnalysisStage('validating');
      const validatedSpaces = await validateAllCoordinates(auditedSpaces);
      console.log(`After hard validation: ${validatedSpaces.length} spaces verified`);

      const finalResult: AnalysisResult = {
        ...filteredResult,
        vacantSpaces: validatedSpaces,
      };

      // Stage 6: Process and display results
      setAnalysisStage('processing');
      setAnalysisResult(finalResult);

      // Create markers for vacant spaces
      if (finalResult.vacantSpaces && finalResult.vacantSpaces.length > 0) {
        const newMarkers = finalResult.vacantSpaces.map(space => ({
          position: [space.coordinates.lat, space.coordinates.lng] as [number, number],
          title: space.location,
          description: `${space.suitability}% suitable - ${space.description}`
        }));
        setMarkers(newMarkers);

        // Fetch nearby POIs for the first result
        setIsLoadingPOIs(true);
        const pois = await fetchNearbyPOIs(
          finalResult.vacantSpaces[0].coordinates.lat,
          finalResult.vacantSpaces[0].coordinates.lng,
          500
        );
        setNearbyPOIs(pois);
        setIsLoadingPOIs(false);

        toast({
          title: "Analysis Complete",
          description: `Found ${finalResult.vacantSpaces.length} verified locations with ${finalResult.confidence}% confidence`,
        });
      } else {
        toast({
          title: "No Suitable Locations",
          description: "All candidate locations were filtered out (water, forest, protected areas, etc.). Try a different area with more urban development.",
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
              zoom={17}
              markers={markers}
              onMapReady={handleMapReady}
              showControls={true}
            />
            <ParcelOverlayStatus
              show={showParcels}
              status={parcelStatus}
              onToggle={handleToggleParcels}
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
                  <Card key={index} className="hover:shadow-md transition-shadow border-2 hover:border-primary/20">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground">{space.location}</h4>
                              {space.validationStatus === 'verified' && (
                                <Badge variant="default" className="bg-green-600 text-white text-xs">
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                  OSM Verified
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {space.coordinates?.lat?.toFixed(6) ?? '—'}, {space.coordinates?.lng?.toFixed(6) ?? '—'}
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
                              Why this location:
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
                              Considerations:
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

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (mapRef.current && space.coordinates?.lat && space.coordinates?.lng) {
                                mapRef.current.setView([space.coordinates.lat, space.coordinates.lng], 18);
                              }
                            }}
                          >
                            <MapPin className="h-4 w-4 mr-1" />
                            Focus on map
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const plan = createPlan({
                                space: {
                                  location: space.location,
                                  coordinates: space.coordinates,
                                  suitability: space.suitability,
                                  description: space.description,
                                  reasons: space.reasons,
                                  considerations: space.considerations,
                                },
                                infra: buildingType as InfraType,
                                searchLocation: location,
                              });
                              navigate(`/plan/${plan.id}`);
                            }}
                          >
                            Generate Build Plan
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* No results after analysis */}
          {analysisResult && analysisResult.vacantSpaces.length === 0 && (
            <Alert>
              <AlertDescription className="text-sm">
                <strong>No suitable vacant spaces found in this area.</strong><br />
                All candidate locations were eliminated during validation (water bodies, forests, protected areas, or other restricted zones).
                Try navigating to an area with more urban development and re-analyze.
              </AlertDescription>
            </Alert>
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
