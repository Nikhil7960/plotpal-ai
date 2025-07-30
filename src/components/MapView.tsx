import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Navigation, X } from "lucide-react";

// Mock data for now - in real app this would come from AI analysis
interface LocationResult {
  id: string;
  address: string;
  coordinates: [number, number];
  score: number;
  justification: string;
  zoning: string;
  size: string;
  attributes: string[];
}

interface MapViewProps {
  city: string;
  results: LocationResult[];
}

const MapView = ({ city, results }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);

  // Mock Mapbox token placeholder - user will need to provide their own
  const MAPBOX_TOKEN = 'pk.YOUR_MAPBOX_TOKEN_HERE';

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // For demo purposes, we'll show a message about Mapbox token
    if (MAPBOX_TOKEN === 'pk.YOUR_MAPBOX_TOKEN_HERE') {
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-74.006, 40.7128], // Default to NYC
      zoom: 12,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    return () => {
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map.current || !results.length) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add new markers
    results.forEach((result, index) => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = index === 0 ? '#3b82f6' : index === 1 ? '#8b5cf6' : '#10b981';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = 'white';
      el.style.fontWeight = 'bold';
      el.style.fontSize = '14px';
      el.innerHTML = (index + 1).toString();

      const marker = new mapboxgl.Marker(el)
        .setLngLat(result.coordinates)
        .addTo(map.current!);

      el.addEventListener('click', () => {
        setSelectedLocation(result);
        map.current?.flyTo({
          center: result.coordinates,
          zoom: 15,
          duration: 1000
        });
      });

      markers.current.push(marker);
    });

    // Fit map to show all markers
    if (results.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      results.forEach(result => bounds.extend(result.coordinates));
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [results]);

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

  if (MAPBOX_TOKEN === 'pk.YOUR_MAPBOX_TOKEN_HERE') {
    return (
      <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center p-8">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Mapbox Token Required</h3>
          <p className="text-muted-foreground mb-4">
            To display the interactive map, please add your Mapbox public token.
          </p>
          <Button variant="outline" onClick={() => window.open('https://mapbox.com/', '_blank')}>
            Get Mapbox Token
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Map Container */}
      <div className="relative">
        <div ref={mapContainer} className="w-full h-96 rounded-lg shadow-lg" />
        
        {/* Selected Location Details */}
        {selectedLocation && (
          <Card className="absolute top-4 left-4 max-w-sm shadow-xl z-10">
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
                <p className="font-medium text-sm">{selectedLocation.address}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`${getScoreColor(selectedLocation.score)} text-white`}>
                    <Star className="w-3 h-3 mr-1" />
                    {selectedLocation.score}/100 - {getScoreText(selectedLocation.score)}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">AI Analysis:</p>
                <p className="text-sm text-muted-foreground">{selectedLocation.justification}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Zoning:</span> {selectedLocation.zoning}
                </div>
                <div>
                  <span className="font-medium">Size:</span> {selectedLocation.size}
                </div>
              </div>
              
              {selectedLocation.attributes.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Key Features:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedLocation.attributes.map((attr, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {attr}
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
      {results.length > 0 && (
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
                        <h4 className="font-semibold">{result.address}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${getScoreColor(result.score)} text-white`}>
                            {result.score}/100
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {getScoreText(result.score)} Match
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{result.justification}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{result.zoning}</Badge>
                      <Badge variant="outline">{result.size}</Badge>
                      {result.attributes.slice(0, 3).map((attr, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {attr}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapView;