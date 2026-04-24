// "Before" imagery of the plot. Tries Google Street View first (best for
// ground-level context), falls back to an ArcGIS World Imagery satellite
// export, so the feature never hard-fails on missing keys.

export type BeforeImageSource = "streetview" | "satellite";

export type StreetViewUnavailableReason =
  | "no-google-key"          // developer hasn't configured VITE_GOOGLE_MAPS_API_KEY
  | "no-coverage"             // Google has no imagery within search radius
  | "metadata-failed"         // network / API error on metadata endpoint
  | "image-failed";           // metadata OK but the image fetch failed

export interface BeforeImage {
  base64: string;
  mime: string;
  source: BeforeImageSource;
  headingDeg?: number;
  note?: string;
  /** When source === "satellite", why we fell back. */
  fallbackReason?: StreetViewUnavailableReason;
}

const STREETVIEW_META = "https://maps.googleapis.com/maps/api/streetview/metadata";
const STREETVIEW_IMG = "https://maps.googleapis.com/maps/api/streetview";
const WORLD_IMAGERY_EXPORT =
  "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export";

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function getGoogleKey(): string | undefined {
  return (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
}

/**
 * Fetch a Street View image via Google. Uses the /metadata endpoint first
 * so we only pay for imagery we know exists. Picks a heading that faces
 * toward the point from a nearby road (Google does this automatically when
 * you omit `heading`, but we expose it for experimentation).
 */
type StreetViewAttempt =
  | { kind: "image"; image: BeforeImage }
  | { kind: "unavailable"; reason: StreetViewUnavailableReason };

async function fetchStreetViewGoogle(
  lat: number, lng: number, opts?: { heading?: number; radiusM?: number }
): Promise<StreetViewAttempt> {
  const key = getGoogleKey();
  if (!key) return { kind: "unavailable", reason: "no-google-key" };

  const radius = opts?.radiusM ?? 80;
  const metaUrl = `${STREETVIEW_META}?location=${lat},${lng}&radius=${radius}&key=${key}`;
  let meta: any;
  try {
    meta = await fetch(metaUrl).then(r => r.json());
  } catch {
    return { kind: "unavailable", reason: "metadata-failed" };
  }
  if (meta.status === "ZERO_RESULTS" || meta.status === "NOT_FOUND") {
    return { kind: "unavailable", reason: "no-coverage" };
  }
  if (meta.status !== "OK") {
    return { kind: "unavailable", reason: "metadata-failed" };
  }

  // Use the actual pano location reported by metadata — Google snaps to the
  // nearest imagery and we need the camera at that point, looking at the plot.
  const panoLat = meta.location?.lat ?? lat;
  const panoLng = meta.location?.lng ?? lng;
  const heading = opts?.heading ?? bearing(panoLat, panoLng, lat, lng);

  const params = new URLSearchParams({
    size: "1024x600",
    location: `${panoLat},${panoLng}`,
    fov: "85",
    pitch: "0",
    heading: String(Math.round(heading)),
    return_error_code: "true",
    key,
  });
  const url = `${STREETVIEW_IMG}?${params.toString()}`;
  let blob: Blob;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return { kind: "unavailable", reason: "image-failed" };
    blob = await resp.blob();
  } catch {
    return { kind: "unavailable", reason: "image-failed" };
  }
  if (blob.size < 2000) {
    return { kind: "unavailable", reason: "no-coverage" };
  }
  return {
    kind: "image",
    image: {
      base64: await blobToBase64(blob),
      mime: blob.type || "image/jpeg",
      source: "streetview",
      headingDeg: Math.round(heading),
    },
  };
}

// Compass bearing from (lat1,lng1) toward (lat2,lng2), in degrees 0-360.
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Satellite fallback — ArcGIS World Imagery export centered on the plot,
 * with a ~200m bounding box so the building site is easily recognisable.
 */
async function fetchSatelliteImagery(
  lat: number, lng: number, halfDegSpan = 0.0015
): Promise<BeforeImage | null> {
  try {
    const bbox = [
      lng - halfDegSpan,
      lat - halfDegSpan * 0.75,  // adjust for 4:3 frame
      lng + halfDegSpan,
      lat + halfDegSpan * 0.75,
    ].join(",");
    const url =
      `${WORLD_IMAGERY_EXPORT}?bbox=${bbox}&bboxSR=4326&imageSR=4326` +
      `&size=1024,600&format=jpg&f=image`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return {
      base64: await blobToBase64(blob),
      mime: blob.type || "image/jpeg",
      source: "satellite",
      note: "Ground-level Street View unavailable; showing aerial view",
    };
  } catch {
    return null;
  }
}

export async function fetchBeforeImage(
  lat: number, lng: number, opts?: { heading?: number }
): Promise<BeforeImage | null> {
  const sv = await fetchStreetViewGoogle(lat, lng, opts);
  if (sv.kind === "image") return sv.image;
  const sat = await fetchSatelliteImagery(lat, lng);
  if (sat) {
    sat.fallbackReason = sv.reason;
    sat.note = noteForReason(sv.reason);
  }
  return sat;
}

function noteForReason(r: StreetViewUnavailableReason): string {
  switch (r) {
    case "no-google-key":
      return "Street View disabled — set VITE_GOOGLE_MAPS_API_KEY to enable ground-level imagery.";
    case "no-coverage":
      return "Google Street View has no coverage at this location; showing aerial view instead.";
    case "metadata-failed":
    case "image-failed":
      return "Couldn't reach Google Street View; showing aerial view instead.";
  }
}
