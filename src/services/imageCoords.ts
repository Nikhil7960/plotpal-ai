// Conversion between image pixel coordinates and geographic coordinates.
// The AI models return spatial positions more reliably as pixel offsets into a
// provided image than as raw lat/lng; we deterministically convert to lat/lng.

export interface ImageBounds {
  north: number; // max latitude
  south: number; // min latitude
  east: number;  // max longitude
  west: number;  // min longitude
}

export interface ImageSize {
  width: number;
  height: number;
}

const R = 20037508.342789244;
const lonToX = (lon: number) => (lon * R) / 180;
const latToY = (lat: number) =>
  (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * R) / Math.PI;
const xToLon = (x: number) => (x * 180) / R;
const yToLat = (y: number) =>
  (Math.atan(Math.exp((y * Math.PI) / R)) * 360) / Math.PI - 90;

export function pixelToLatLng(
  px: number,
  py: number,
  bounds: ImageBounds,
  size: ImageSize
): { lat: number; lng: number } {
  const xw = lonToX(bounds.west);
  const xe = lonToX(bounds.east);
  const yn = latToY(bounds.north);
  const ys = latToY(bounds.south);

  const mx = xw + (px / size.width) * (xe - xw);
  const my = yn - (py / size.height) * (yn - ys);

  return { lng: xToLon(mx), lat: yToLat(my) };
}

export function latLngToPixel(
  lat: number,
  lng: number,
  bounds: ImageBounds,
  size: ImageSize
): { px: number; py: number } {
  const xw = lonToX(bounds.west);
  const xe = lonToX(bounds.east);
  const yn = latToY(bounds.north);
  const ys = latToY(bounds.south);
  const x = lonToX(lng);
  const y = latToY(lat);
  return {
    px: ((x - xw) / (xe - xw)) * size.width,
    py: ((yn - y) / (yn - ys)) * size.height,
  };
}

export function isInBounds(
  lat: number,
  lng: number,
  bounds: ImageBounds,
  marginFraction = 0
): boolean {
  const latSpan = bounds.north - bounds.south;
  const lngSpan = bounds.east - bounds.west;
  const latMargin = latSpan * marginFraction;
  const lngMargin = lngSpan * marginFraction;
  return (
    lat >= bounds.south - latMargin &&
    lat <= bounds.north + latMargin &&
    lng >= bounds.west - lngMargin &&
    lng <= bounds.east + lngMargin
  );
}
