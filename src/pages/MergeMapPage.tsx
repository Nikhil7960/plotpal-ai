import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import L from "leaflet";
import OSMMap from "@/components/OSMMap";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import {
  attachArcGISParcelOverlay,
  type ArcGISParcelOverlayHandle,
  type ParcelStatus,
} from "@/utils/arcgisParcels";

const DEFAULT_CENTER: [number, number] = [19.076, 72.8777];
const DEFAULT_ZOOM = 17;

export default function MergeMapPage() {
  const [searchParams] = useSearchParams();
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<ArcGISParcelOverlayHandle | null>(null);
  const [showParcels, setShowParcels] = useState(true);
  const [status, setStatus] = useState<ParcelStatus>({ kind: "idle" });

  const initialCenter = useMemo((): [number, number] => {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    if (lat != null && lng != null) {
      const parsed = [parseFloat(lat), parseFloat(lng)];
      if (!Number.isNaN(parsed[0]) && !Number.isNaN(parsed[1]))
        return parsed as [number, number];
    }
    return DEFAULT_CENTER;
  }, [searchParams]);

  const initialZoom = useMemo(() => {
    const zoomParam = searchParams.get("zoom");
    if (zoomParam != null) {
      const z = parseInt(zoomParam, 10);
      if (!Number.isNaN(z)) return Math.min(23, Math.max(0, z));
    }
    return DEFAULT_ZOOM;
  }, [searchParams]);

  const onMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    overlayRef.current?.destroy();
    overlayRef.current = attachArcGISParcelOverlay({
      map,
      minZoom: 15,
      onStatusChange: setStatus,
    });
    map.invalidateSize();
  }, []);

  useEffect(() => {
    return () => {
      overlayRef.current?.destroy();
    };
  }, []);

  const statusLabel = (() => {
    switch (status.kind) {
      case "loading":
        return "Loading parcels…";
      case "hidden-zoom":
        return `Zoom in to level ${status.minZoom}+ to see parcels`;
      case "hidden-area":
        return "Zoom in further — area too wide";
      case "ready":
        return `Showing ${status.landParcels} parcels, ${status.finalPlots} final plots`;
      case "error":
        return `Failed: ${status.message}`;
      default:
        return showParcels ? "Property overlay ready" : "Property overlay hidden";
    }
  })();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 shrink-0">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild aria-label="Back to home">
              <Link to="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Merge Map</h1>
              <p className="text-sm text-muted-foreground">
                Mumbai property parcels overlaid on OpenStreetMap / satellite. Zoom 15+ to see parcels.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Button
              size="sm"
              variant={showParcels ? "default" : "outline"}
              onClick={() => {
                const next = !showParcels;
                setShowParcels(next);
                overlayRef.current?.setVisible(next);
              }}
            >
              {showParcels ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
              Property overlay
            </Button>
            <span className="text-muted-foreground">{statusLabel}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 min-h-0">
        <div className="min-h-[500px] h-[calc(100vh-9rem)] rounded-lg overflow-hidden border">
          <OSMMap
            center={initialCenter}
            zoom={initialZoom}
            onMapReady={onMapReady}
            height="100%"
            showControls={true}
            defaultTileLayer="satellite"
          />
        </div>
      </div>
    </div>
  );
}
