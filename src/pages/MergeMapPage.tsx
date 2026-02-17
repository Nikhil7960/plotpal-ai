import React, { useRef, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import L from "leaflet";
import OSMMap from "@/components/OSMMap";
import ArcGISPropertyLookupIframe from "@/components/ArcGISPropertyLookupIframe";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  leafletBoundsToExtent,
  buildArcGISViewerUrl,
  centerZoomToExtent,
} from "@/utils/mergemapSync";

const DEFAULT_CENTER: [number, number] = [19.076, 72.8777];
const DEFAULT_ZOOM = 12;

export default function MergeMapPage() {
  const [searchParams] = useSearchParams();
  const mapRef = useRef<L.Map | null>(null);
  const [arcgisUrl, setArcgisUrl] = useState<string>(() => {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const zoomParam = searchParams.get("zoom");
    const center: [number, number] =
      lat != null && lng != null
        ? [parseFloat(lat), parseFloat(lng)]
        : DEFAULT_CENTER;
    const zoom =
      zoomParam != null
        ? Math.min(23, Math.max(0, parseInt(zoomParam, 10)))
        : DEFAULT_ZOOM;
    const extent = centerZoomToExtent(center, zoom);
    return buildArcGISViewerUrl({ extent });
  });
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const skipNextMoveend = useRef(true);

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
    setIsIframeLoading(true);
  }, []);

  const onMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    map.on("moveend", syncToArcgis);
    map.invalidateSize();
  }, [syncToArcgis]);

  React.useEffect(() => {
    return () => {
      mapRef.current?.off("moveend", syncToArcgis);
    };
  }, [syncToArcgis]);

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
                Pan or zoom the left map; the right map updates when you release.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-0">
        <div className="min-h-[400px] lg:min-h-0 flex flex-col">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Leaflet (source of truth)
          </h2>
          <div className="flex-1 min-h-[300px] rounded-lg overflow-hidden border">
            <OSMMap
              center={initialCenter}
              zoom={initialZoom}
              onMapReady={onMapReady}
              height="500px"
              showControls={true}
              defaultTileLayer="osm"
            />
          </div>
        </div>

        <div className="min-h-[400px] lg:min-h-0 flex flex-col">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            ArcGIS Property Lookup (Mumbai)
          </h2>
          <ArcGISPropertyLookupIframe
            src={arcgisUrl}
            isLoading={isIframeLoading}
            onLoad={() => setIsIframeLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}
