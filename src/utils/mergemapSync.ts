import type L from "leaflet";

const ARCGIS_VIEWER_BASE =
  "https://www.arcgis.com/apps/webappviewer/index.html?id=3a5c0a98a75341b985c10700dec6c4b8";

/**
 * Convert Leaflet bounds to ArcGIS extent string (minLng,minLat,maxLng,maxLat) in GCS.
 */
export function leafletBoundsToExtent(bounds: L.LatLngBounds): string {
  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  return [west, south, east, north].map((n) => n.toFixed(6)).join(",");
}

/** Property/parcel layer IDs so red shaded layers are visible when the iframe loads. */
const PROPERTY_LAYER_IDS =
  "MCGMGIS_Departments_Master_All_Layers_7387;Development_Plan_2034_5938;Development_Department_8086";

/**
 * Build ArcGIS Web App Viewer URL with extent and showLayers (red property layers visible).
 */
export function buildArcGISViewerUrl(options: { extent: string }): string {
  const params = new URLSearchParams();
  params.set("extent", options.extent);
  params.set("showLayers", PROPERTY_LAYER_IDS);
  return `${ARCGIS_VIEWER_BASE}&${params.toString()}`;
}

/**
 * Build initial extent from center [lat, lng] and zoom by approximating a bounding box.
 * Leaflet zoom level corresponds roughly to ArcGIS level; we derive a delta for lat/lng.
 */
export function centerZoomToExtent(
  center: [number, number],
  zoom: number
): string {
  const [lat, lng] = center;
  // Approximate degrees per pixel at given zoom (Web Mercator); ~360/256/2^zoom at equator.
  const scale = 360 / Math.pow(2, zoom + 8);
  const delta = scale * 128; // half of 256px tile
  const minLng = (lng - delta).toFixed(6);
  const minLat = (lat - delta).toFixed(6);
  const maxLng = (lng + delta).toFixed(6);
  const maxLat = (lat + delta).toFixed(6);
  return [minLng, minLat, maxLng, maxLat].join(",");
}
