import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Satellite, Map, Layers } from 'lucide-react';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface OSMMapProps {
  center: [number, number];
  zoom?: number;
  onMapReady?: (map: L.Map) => void;
  markers?: Array<{
    position: [number, number];
    title: string;
    description?: string;
  }>;
  height?: string;
  showControls?: boolean;
  defaultTileLayer?: 'satellite' | 'osm' | 'terrain';
}

// Map events handler
function MapEventsHandler({ onMapReady, mapRef }: { onMapReady?: (map: L.Map) => void; mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      mapRef.current = map;
      if (onMapReady) {
        onMapReady(map);
      }
    }
  }, [map, mapRef, onMapReady]);
  
  return null;
}

export default function OSMMap({
  center,
  zoom = 15,
  onMapReady,
  markers = [],
  height = '600px',
  showControls = true,
  defaultTileLayer = 'satellite'
}: OSMMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [tileLayer, setTileLayer] = useState<'satellite' | 'osm' | 'terrain'>(defaultTileLayer);
  
  const tileLayerConfig = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri'
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors'
    },
    terrain: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '© OpenTopoMap'
    }
  };

  return (
    <Card className="overflow-hidden relative">
      <div style={{ height, position: 'relative' }} className="leaflet-container-wrapper">
        {showControls && (
          <div className="absolute top-4 right-4 z-[9999] flex gap-2">
            <Button
              size="sm"
              variant={tileLayer === 'satellite' ? 'default' : 'outline'}
              onClick={() => setTileLayer('satellite')}
              className="bg-white/90 backdrop-blur shadow-md"
            >
              <Satellite className="h-4 w-4 mr-1" />
              Satellite
            </Button>
            <Button
              size="sm"
              variant={tileLayer === 'osm' ? 'default' : 'outline'}
              onClick={() => setTileLayer('osm')}
              className="bg-white/90 backdrop-blur shadow-md"
            >
              <Map className="h-4 w-4 mr-1" />
              Street
            </Button>
            <Button
              size="sm"
              variant={tileLayer === 'terrain' ? 'default' : 'outline'}
              onClick={() => setTileLayer('terrain')}
              className="bg-white/90 backdrop-blur shadow-md"
            >
              <Layers className="h-4 w-4 mr-1" />
              Terrain
            </Button>
          </div>
        )}
        
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            key={tileLayer}
            url={tileLayerConfig[tileLayer].url}
            attribution={tileLayerConfig[tileLayer].attribution}
            maxZoom={19}
          />
          
          <MapEventsHandler onMapReady={onMapReady} mapRef={mapRef} />
          
          {markers.map((marker, index) => (
            <Marker key={index} position={marker.position}>
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">{marker.title}</h3>
                  {marker.description && (
                    <p className="text-xs mt-1">{marker.description}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </Card>
  );
}
