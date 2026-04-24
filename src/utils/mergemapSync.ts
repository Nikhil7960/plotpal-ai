import type L from "leaflet";

// Mumbai Development_Plan_2034 MapServer — renders Land Parcels (layer 13)
// together with wards/villages/TP schemes. This is the layer the Property
// Lookup viewer shades red.
const DP_MAPSERVER =
  "https://agsmaps.mcgm.gov.in/server/rest/services/Development_Plan_2034/MapServer";

// Land Parcels (layer 13) hides when scale > 6000. For an 800×600 PNG at
// 96dpi that corresponds to a bbox width of roughly ~1100m at Mumbai's latitude.
// We clamp exports to this width so the red shading is always rendered.
const PARCEL_SCALE_LIMIT = 6000;
const EXPORT_DPI = 96;

/**
 * Convert Leaflet bounds to a comma-separated bbox string in WGS84.
 */
export function leafletBoundsToExtent(bounds: L.LatLngBounds): string {
  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  return [west, south, east, north].map((n) => n.toFixed(6)).join(",");
}

/**
 * Build a WGS84 bbox string from a center and Leaflet zoom.
 */
export function centerZoomToExtent(
  center: [number, number],
  zoom: number
): string {
  const [lat, lng] = center;
  const scale = 360 / Math.pow(2, zoom + 8);
  const delta = scale * 128;
  return [
    (lng - delta).toFixed(6),
    (lat - delta).toFixed(6),
    (lng + delta).toFixed(6),
    (lat + delta).toFixed(6),
  ].join(",");
}

function computeScale(widthMeters: number, widthPixels: number): number {
  const imgMeters = (widthPixels / EXPORT_DPI) * 0.0254;
  return widthMeters / imgMeters;
}

function shrinkBboxToScale(
  extent: string,
  widthPx: number,
  heightPx: number,
  targetScale: number
): string {
  const [minLng, minLat, maxLng, maxLat] = extent.split(",").map(parseFloat);
  const lat = (minLat + maxLat) / 2;
  const lng = (minLng + maxLng) / 2;
  const metersPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const metersPerDegLat = 110540;

  // ArcGIS expands the bbox to match image aspect ratio. Pre-match it here so
  // the returned scale is predictable.
  const imgAspect = widthPx / heightPx;
  let halfW = (maxLng - minLng) / 2;
  let halfH = (maxLat - minLat) / 2;
  const widthMetersNow = halfW * 2 * metersPerDegLng;
  const heightMetersNow = halfH * 2 * metersPerDegLat;
  const bboxAspect = widthMetersNow / Math.max(heightMetersNow, 1e-9);
  if (bboxAspect < imgAspect) {
    // widen horizontally
    const newWidthMeters = heightMetersNow * imgAspect;
    halfW = newWidthMeters / 2 / metersPerDegLng;
  } else {
    // tall-ify vertically
    const newHeightMeters = widthMetersNow / imgAspect;
    halfH = newHeightMeters / 2 / metersPerDegLat;
  }

  // Now enforce the scale ceiling, with some headroom.
  const widthMeters = halfW * 2 * metersPerDegLng;
  const currentScale = computeScale(widthMeters, widthPx);
  const scaleHeadroom = 0.85; // stay comfortably inside the 6000 threshold

  if (currentScale > targetScale * scaleHeadroom) {
    const shrink = (targetScale * scaleHeadroom) / currentScale;
    halfW *= shrink;
    halfH *= shrink;
  }

  return [
    (lng - halfW).toFixed(6),
    (lat - halfH).toFixed(6),
    (lng + halfW).toFixed(6),
    (lat + halfH).toFixed(6),
  ].join(",");
}

/**
 * Render a PNG showing Mumbai property parcels + wards + TP schemes over the
 * given extent. Automatically tightens the bbox so the map scale stays within
 * the upstream layer's visibility threshold (6000). Returns base64 or null.
 */
export async function fetchArcGISMapExport(
  extent: string,
  width: number = 800,
  height: number = 600
): Promise<string | null> {
  try {
    const safeExtent = shrinkBboxToScale(extent, width, height, PARCEL_SCALE_LIMIT);
    const layers = "show:10,11,12,13"; // wards, villages, TP schemes, parcels
    const url =
      `${DP_MAPSERVER}/export?bbox=${safeExtent}&bboxSR=4326&imageSR=4326` +
      `&size=${width},${height}&format=png&transparent=true&layers=${layers}&f=image`;

    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await blobToBase64(blob);
  } catch (error) {
    console.warn("ArcGIS map export failed:", error);
    return null;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
