import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, AlertCircle, Mountain, Map, RotateCcw } from 'lucide-react';

interface GoogleMapProps {
  city: string;
  coordinates: [number, number]; // [longitude, latitude]
  className?: string;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const GoogleMap = ({ city, coordinates, className }: GoogleMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [map, setMap] = useState<any>(null);
  const [is3DView, setIs3DView] = useState(false);
  const [viewMode, setViewMode] = useState<'satellite' | 'hybrid' | 'roadmap'>('hybrid');

  useEffect(() => {
    const loadGoogleMaps = () => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      // Check if script is already being loaded
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Wait for the script to load
        const checkGoogleMaps = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkGoogleMaps);
            initializeMap();
          }
        }, 100);
        return;
      }

      // Load Google Maps script
      const script = document.createElement('script');
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        setMapError('Google Maps API key is not configured');
        setMapLoading(false);
        return;
      }

      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        initializeMap();
      };
      
      script.onerror = () => {
        setMapError('Failed to load Google Maps');
        setMapLoading(false);
      };

      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapRef.current || !window.google) return;

      try {
        const [longitude, latitude] = coordinates;
        
        const mapOptions = {
          center: { lat: latitude, lng: longitude },
          zoom: 16, // Higher zoom for better 3D effect
          mapTypeId: window.google.maps.MapTypeId.HYBRID,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          tilt: 0, // Start with 2D view
          heading: 0,
          gestureHandling: 'auto',
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'on' }]
            }
          ]
        };

        const googleMap = new window.google.maps.Map(mapRef.current, mapOptions);

        // Add a marker for the city
        new window.google.maps.Marker({
          position: { lat: latitude, lng: longitude },
          map: googleMap,
          title: city,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#3b82f6',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 8
          }
        });

        // Add info window
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; font-family: system-ui;">
              <h3 style="margin: 0 0 4px 0; color: #1f2937; font-size: 16px; font-weight: 600;">${city}</h3>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}</p>
            </div>
          `
        });

        // Open info window on marker click
        const marker = new window.google.maps.Marker({
          position: { lat: latitude, lng: longitude },
          map: googleMap,
          title: city
        });

        marker.addListener('click', () => {
          infoWindow.open(googleMap, marker);
        });

        setMap(googleMap);
        setMapLoading(false);
        setMapError(null);
        
      } catch (error) {
        console.error('Error initializing map:', error);
        setMapError('Failed to initialize map');
        setMapLoading(false);
      }
    };

    loadGoogleMaps();
  }, [city, coordinates]);

  // Toggle 3D view
  const toggle3DView = () => {
    if (!map) return;
    
    setIs3DView(!is3DView);
    
    if (!is3DView) {
      // Enable 3D view
      map.setTilt(45);
      map.setZoom(18);
    } else {
      // Disable 3D view
      map.setTilt(0);
      map.setZoom(16);
    }
  };

  // Change map type
  const changeMapType = (type: 'satellite' | 'hybrid' | 'roadmap') => {
    if (!map) return;
    
    setViewMode(type);
    let mapTypeId;
    
    switch (type) {
      case 'satellite':
        mapTypeId = window.google.maps.MapTypeId.SATELLITE;
        break;
      case 'hybrid':
        mapTypeId = window.google.maps.MapTypeId.HYBRID;
        break;
      case 'roadmap':
        mapTypeId = window.google.maps.MapTypeId.ROADMAP;
        break;
    }
    
    map.setMapTypeId(mapTypeId);
  };

  // Reset map view
  const resetMapView = () => {
    if (!map || !coordinates) return;
    
    const [longitude, latitude] = coordinates;
    map.setCenter({ lat: latitude, lng: longitude });
    map.setZoom(16);
    map.setTilt(0);
    map.setHeading(0);
    setIs3DView(false);
  };

  // Handle coordinate changes for existing map
  useEffect(() => {
    if (map && coordinates) {
      const [longitude, latitude] = coordinates;
      const newCenter = { lat: latitude, lng: longitude };
      
      map.setCenter(newCenter);
      map.setZoom(is3DView ? 18 : 16);
      
      // Clear existing markers and add new one
      // Note: In a production app, you'd want to manage markers more efficiently
      new window.google.maps.Marker({
        position: newCenter,
        map: map,
        title: city
      });
    }
  }, [map, coordinates, city]);

  if (mapError) {
    return (
      <Card className="glass-card border-0 h-[500px] flex items-center justify-center">
        <CardContent className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Map Error</h3>
          <p className="text-muted-foreground">{mapError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`glass-card border-0 overflow-hidden ${className}`}>
      <CardContent className="p-0 relative">
        {mapLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        
        <div className="bg-accent/5 p-4 border-b border-border/20">
          {/* City Info Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary to-primary-glow rounded-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{city}</h3>
              <p className="text-sm text-muted-foreground">
                {coordinates && `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}`}
              </p>
            </div>
          </div>
          
          {/* Map Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 3D Toggle */}
            <Button
              variant={is3DView ? "default" : "outline"}
              size="sm"
              onClick={toggle3DView}
              className="flex items-center gap-2 font-semibold transition-all duration-200 hover:scale-105"
            >
              <Mountain className="w-4 h-4" />
              {is3DView ? '3D View' : 'Enable 3D'}
            </Button>
            
            {/* Map Type Selector */}
            <div className="flex items-center gap-1 bg-background/50 rounded-lg p-1">
              <Button
                variant={viewMode === 'satellite' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => changeMapType('satellite')}
                className="text-xs px-3 py-1.5"
              >
                Satellite
              </Button>
              <Button
                variant={viewMode === 'hybrid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => changeMapType('hybrid')}
                className="text-xs px-3 py-1.5"
              >
                Hybrid
              </Button>
              <Button
                variant={viewMode === 'roadmap' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => changeMapType('roadmap')}
                className="text-xs px-3 py-1.5"
              >
                Street
              </Button>
            </div>
            
            {/* Reset View */}
            <Button
              variant="outline"
              size="sm"
              onClick={resetMapView}
              className="flex items-center gap-2 font-medium hover:scale-105 transition-all duration-200"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          </div>
          
          {/* 3D View Indicator */}
          {is3DView && (
            <div className="mt-3 flex items-center gap-2 text-sm text-primary">
              <Mountain className="w-4 h-4" />
              <span className="font-medium">3D View Active - Drag to rotate, scroll to zoom</span>
            </div>
          )}
        </div>
        
        <div 
          ref={mapRef}
          className="w-full h-[600px] bg-muted/20"
          style={{ minHeight: '600px' }}
        />
      </CardContent>
    </Card>
  );
};

export default GoogleMap;