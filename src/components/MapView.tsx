import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Navigation, X } from "lucide-react";

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.Marker[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize Leaflet map with OpenStreetMap tiles
    map.current = L.map(mapContainer.current).setView([40.7128, -74.006], 12);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map.current);

    // Add zoom control
    L.control.zoom({ position: 'topright' }).addTo(map.current);

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
      // Create custom marker icon
      const customIcon = L.divIcon({
        html: `<div style="
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
        ">${index + 1}</div>`,
        className: 'custom-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([result.coordinates[1], result.coordinates[0]], {
        icon: customIcon
      }).addTo(map.current!);

      marker.on('click', () => {
        setSelectedLocation(result);
        map.current?.setView([result.coordinates[1], result.coordinates[0]], 15, {
          animate: true,
          duration: 1
        });
      });

      markers.current.push(marker);
    });

    // Fit map to show all markers
    if (results.length > 0) {
      const group = new L.FeatureGroup(markers.current);
      map.current.fitBounds(group.getBounds(), { padding: [20, 20] });
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