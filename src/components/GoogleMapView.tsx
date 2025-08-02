import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Star, Navigation, X, Map, Satellite, Crosshair } from "lucide-react";
import { toast } from "sonner";

interface LocationResult {
  id: string;
  title: string;
  address: string;
  coordinates: [number, number];
  score: number;
  justification: string;
  zoning: string;
  size: string;
  attributes: string[];
  price: number;
  plotType: string;
  amenities: string[];
}

interface GoogleMapViewProps {
  city: string;
  results: LocationResult[];
  cityCoordinates?: [number, number] | null;
}

const GoogleMapView = ({ city, results, cityCoordinates }: GoogleMapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [googleApiKey, setGoogleApiKey] = useState('AIzaSyC8I1N97IdW38H5bIEAzPA5b_c6N6Jc-i4');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('satellite');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Get user location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserLocation(coords);
          if (map.current) {
            map.current.panTo({ lat: coords[1], lng: coords[0] });
            map.current.setZoom(15);
          }
          toast.success("Location found!");
        },
        (error) => {
          toast.error("Could not get your location");
          console.error("Geolocation error:", error);
        }
      );
    } else {
      toast.error("Geolocation is not supported by this browser");
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current || !googleApiKey) return;

    try {
      const loader = new Loader({
        apiKey: googleApiKey,
        version: "weekly",
        libraries: ["places", "geometry"]
      });

      await loader.load();

      // Get initial coordinates
      const initialCoords = cityCoordinates 
        ? { lat: cityCoordinates[1], lng: cityCoordinates[0] }
        : results.length > 0 
          ? { lat: results[0].coordinates[1], lng: results[0].coordinates[0] }
          : { lat: 20.5937, lng: 78.9629 }; // Center of India

      map.current = new google.maps.Map(mapContainer.current, {
        center: initialCoords,
        zoom: 12,
        mapTypeId: mapType,
        tilt: 45,
        heading: 0,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      });

      setIsMapLoaded(true);
      toast.success("Map loaded successfully!");
    } catch (error) {
      console.error("Error loading Google Maps:", error);
      toast.error(`Failed to load Google Maps: ${error.message}`);
    }
  };

  useEffect(() => {
    if (googleApiKey && !map.current) {
      initializeMap();
    }
  }, [googleApiKey]);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.setMap(null));
    markers.current = [];

    // If no results but we have city coordinates, center map on city
    if (results.length === 0 && cityCoordinates) {
      map.current.panTo({ lat: cityCoordinates[1], lng: cityCoordinates[0] });
      map.current.setZoom(12);
      return;
    }

    // Add new markers for results
    results.forEach((result, index) => {
      const marker = new google.maps.Marker({
        position: { lat: result.coordinates[1], lng: result.coordinates[0] },
        map: map.current!,
        title: result.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: index === 0 ? '#3b82f6' : index === 1 ? '#8b5cf6' : '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
          scale: 16,
        },
        label: {
          text: (index + 1).toString(),
          color: 'white',
          fontWeight: 'bold',
          fontSize: '14px'
        }
      });

      marker.addListener('click', () => {
        setSelectedLocation(result);
        map.current?.panTo({ lat: result.coordinates[1], lng: result.coordinates[0] });
        map.current?.setZoom(16);
      });

      markers.current.push(marker);
    });

    // Fit map to show all markers
    if (results.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      results.forEach(result => {
        bounds.extend({ lat: result.coordinates[1], lng: result.coordinates[0] });
      });
      map.current.fitBounds(bounds);
    }
  }, [results, cityCoordinates, isMapLoaded]);

  const changeMapType = (type: 'roadmap' | 'satellite') => {
    if (map.current) {
      setMapType(type);
      map.current.setMapTypeId(type);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-success";
    if (score >= 75) return "bg-primary";
    if (score >= 60) return "bg-warning";
    return "bg-destructive";
  };

  const getScoreText = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Great";
    if (score >= 60) return "Good";
    return "Fair";
  };

  if (!isMapLoaded) {
    return (
      <div className="space-y-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Satellite className="w-5 h-5 text-primary" />
              Google Maps Configuration Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="google-api-key">Google Maps API Key</Label>
              <Input
                id="google-api-key"
                type="password"
                placeholder="AIzaSyB..."
                value={googleApiKey}
                onChange={(e) => setGoogleApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your free API key from{' '}
                <a 
                  href="https://developers.google.com/maps/documentation/javascript/get-api-key" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Cloud Console
                </a>
              </p>
            </div>
            <Button onClick={initializeMap} disabled={!googleApiKey} className="w-full">
              Initialize Google Maps
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Map Container */}
      <div className="relative">
        <div ref={mapContainer} className="w-full h-96 rounded-lg shadow-lg" />
        
        {/* Map Controls */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
          <Button
            onClick={() => changeMapType('satellite')}
            variant={mapType === 'satellite' ? 'default' : 'outline'}
            size="sm"
            className="bg-background/90 backdrop-blur-sm"
          >
            <Satellite className="w-4 h-4 mr-1" />
            Satellite
          </Button>
          <Button
            onClick={() => changeMapType('roadmap')}
            variant={mapType === 'roadmap' ? 'default' : 'outline'}
            size="sm"
            className="bg-background/90 backdrop-blur-sm"
          >
            <Map className="w-4 h-4 mr-1" />
            Street
          </Button>
          <Button
            onClick={getUserLocation}
            variant="outline"
            size="sm"
            className="bg-background/90 backdrop-blur-sm"
          >
            <Crosshair className="w-4 h-4" />
          </Button>
        </div>

        {/* Selected Location Details */}
        {selectedLocation && (
          <Card className="absolute top-4 right-4 max-w-sm shadow-xl z-10 bg-background/95 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Location Details
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSelectedLocation(null)}
                  className="h-6 w-6"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm">{selectedLocation.title}</h4>
                <p className="text-xs text-muted-foreground">{selectedLocation.address}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`${getScoreColor(selectedLocation.score)} text-white`}>
                    <Star className="w-3 h-3 mr-1" />
                    {selectedLocation.score}/100 - {getScoreText(selectedLocation.score)}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">AI Analysis:</p>
                <p className="text-xs text-muted-foreground">{selectedLocation.justification}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-medium">Type:</span> {selectedLocation.plotType}
                </div>
                <div>
                  <span className="font-medium">Size:</span> {selectedLocation.size}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Price:</span> ₹{(selectedLocation.price / 10000000).toFixed(1)}Cr
                </div>
              </div>
              
              {selectedLocation.amenities.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Amenities:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedLocation.amenities.slice(0, 4).map((amenity, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <Button variant="outline" size="sm" className="w-full">
                <Navigation className="w-4 h-4 mr-2" />
                Get Directions
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results List */}
      {results.length > 0 ? (
        <div className="grid gap-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            Top Recommendations for {city}
          </h3>
          
          {results.map((result, index) => (
            <Card 
              key={result.id} 
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedLocation?.id === result.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedLocation(result)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ 
                      backgroundColor: index === 0 ? '#3b82f6' : index === 1 ? '#8b5cf6' : '#10b981' 
                    }}
                  >
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{result.title}</h4>
                        <p className="text-sm text-muted-foreground">{result.address}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${getScoreColor(result.score)} text-white`}>
                            {result.score}/100
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {getScoreText(result.score)} Match
                          </span>
                          <span className="text-sm font-medium text-primary">
                            ₹{(result.price / 10000000).toFixed(1)}Cr
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{result.justification}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{result.plotType}</Badge>
                      <Badge variant="outline">{result.size}</Badge>
                      {result.amenities.slice(0, 3).map((amenity, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center space-y-4">
          <h3 className="text-xl font-bold flex items-center justify-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Viewing {city}
          </h3>
          <p className="text-muted-foreground">
            Found 0 suitable plots for your criteria. The map shows the searched location with satellite and street view options.
          </p>
        </div>
      )}
    </div>
  );
};

export default GoogleMapView;