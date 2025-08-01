import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Star, Navigation, X, Map, Satellite, Building, Crosshair, Eye } from "lucide-react";
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

interface MapboxViewProps {
  city: string;
  results: LocationResult[];
  cityCoordinates?: [number, number] | null;
}

const MapboxView = ({ city, results, cityCoordinates }: MapboxViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [isTokenSet, setIsTokenSet] = useState(false);
  const [mapStyle, setMapStyle] = useState('satellite-streets');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Get user location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserLocation(coords);
          if (map.current) {
            map.current.flyTo({
              center: coords,
              zoom: 15,
              duration: 2000
            });
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

  const initializeMap = () => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    // Get initial coordinates
    const initialCoords = cityCoordinates 
      ? [cityCoordinates[0], cityCoordinates[1]] as [number, number]
      : results.length > 0 
        ? [results[0].coordinates[0], results[0].coordinates[1]] as [number, number]
        : [78.9629, 20.5937] as [number, number]; // Center of India

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: `mapbox://styles/mapbox/${mapStyle}-v12`,
      center: initialCoords,
      zoom: 12,
      pitch: 45,
      bearing: 0,
      projection: 'globe' as any
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl({
      visualizePitch: true
    }), 'top-right');

    // Add geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    map.current.addControl(geolocate, 'top-right');

    // Add fullscreen control
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Add atmosphere and fog effects for globe
    map.current.on('style.load', () => {
      map.current?.setFog({
        'range': [1, 20],
        'color': 'rgb(186, 210, 235)',
        'high-color': 'rgb(36, 92, 223)',
        'horizon-blend': 0.02
      });
    });

    setIsTokenSet(true);
  };

  useEffect(() => {
    if (mapboxToken && !map.current) {
      initializeMap();
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!map.current || !isTokenSet) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // If no results but we have city coordinates, center map on city
    if (results.length === 0 && cityCoordinates) {
      map.current.flyTo({
        center: [cityCoordinates[0], cityCoordinates[1]],
        zoom: 12,
        duration: 1000
      });
      return;
    }

    // Add new markers for results
    results.forEach((result, index) => {
      // Create custom marker element
      const markerElement = document.createElement('div');
      markerElement.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: ${index === 0 ? '#3b82f6' : index === 1 ? '#8b5cf6' : '#10b981'};
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
        cursor: pointer;
      `;
      markerElement.textContent = (index + 1).toString();

      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([result.coordinates[0], result.coordinates[1]])
        .addTo(map.current!);

      markerElement.addEventListener('click', () => {
        setSelectedLocation(result);
        map.current?.flyTo({
          center: [result.coordinates[0], result.coordinates[1]],
          zoom: 16,
          pitch: 60,
          duration: 1500
        });
      });

      markers.current.push(marker);
    });

    // Fit map to show all markers
    if (results.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      results.forEach(result => {
        bounds.extend([result.coordinates[0], result.coordinates[1]]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [results, cityCoordinates, isTokenSet]);

  const changeMapStyle = (style: string) => {
    if (map.current) {
      setMapStyle(style);
      map.current.setStyle(`mapbox://styles/mapbox/${style}-v12`);
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

  if (!isTokenSet) {
    return (
      <div className="space-y-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Satellite className="w-5 h-5 text-primary" />
              Mapbox Configuration Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mapbox-token">Mapbox Public Token</Label>
              <Input
                id="mapbox-token"
                type="password"
                placeholder="pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6..."
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your free token from{' '}
                <a 
                  href="https://mapbox.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  mapbox.com
                </a>
              </p>
            </div>
            <Button onClick={initializeMap} disabled={!mapboxToken} className="w-full">
              Initialize 3D Map
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
            onClick={() => changeMapStyle('satellite-streets')}
            variant={mapStyle === 'satellite-streets' ? 'default' : 'outline'}
            size="sm"
            className="bg-background/90 backdrop-blur-sm"
          >
            <Satellite className="w-4 h-4 mr-1" />
            3D
          </Button>
          <Button
            onClick={() => changeMapStyle('streets')}
            variant={mapStyle === 'streets' ? 'default' : 'outline'}
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
          <Card className="absolute top-4 right-20 max-w-sm shadow-xl z-10 bg-background/95 backdrop-blur-sm">
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
            Found 0 suitable plots for your criteria. The map shows the searched location in 3D satellite view.
          </p>
        </div>
      )}
    </div>
  );
};

export default MapboxView;