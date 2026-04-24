import L from "leaflet";
import type { FeatureCollection } from "geojson";

const LAND_PARCELS_URL =
  "https://agsmaps.mcgm.gov.in/server/rest/services/Development_Plan_2034/MapServer/13";
const FINAL_PLOTS_URL =
  "https://agsmaps.mcgm.gov.in/server/rest/services/Development_Department/MapServer/3";

const LAND_PARCEL_FIELDS = "OBJECTID,CTS_CS_NO,VILLAGE,AREA_APP_SQ_MTRS,WARD,LABLE";
const FINAL_PLOT_FIELDS = "OBJECTID,FP_NO,TPS_NAME,VILLAGE,AREA_APP_SQ_MTRS";

const MAX_RECORD_COUNT = 2500;

// Cap the fetch area so we don't request all-Mumbai parcels at low zoom.
// Upstream service chokes on very wide bboxes and the browser struggles with
// thousands of polygons.
const MAX_BBOX_DEG = 0.03;

function boundsToExtentParam(bounds: L.LatLngBounds): string {
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
    .map((n) => n.toFixed(6))
    .join(",");
}

function bboxTooLarge(bounds: L.LatLngBounds): boolean {
  const widthDeg = bounds.getEast() - bounds.getWest();
  const heightDeg = bounds.getNorth() - bounds.getSouth();
  return widthDeg > MAX_BBOX_DEG || heightDeg > MAX_BBOX_DEG;
}

async function fetchGeoJSON(
  serviceUrl: string,
  bounds: L.LatLngBounds,
  outFields: string,
  signal: AbortSignal
): Promise<FeatureCollection | null> {
  const extent = boundsToExtentParam(bounds);
  const params = new URLSearchParams({
    geometry: extent,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "true",
    resultRecordCount: String(MAX_RECORD_COUNT),
    f: "geojson",
  });
  const url = `${serviceUrl}/query?${params.toString()}`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) return null;
  const data = (await resp.json()) as FeatureCollection;
  if (!data || data.type !== "FeatureCollection") return null;
  return data;
}

export interface ArcGISParcelOverlayHandle {
  layer: L.LayerGroup;
  refresh: () => void;
  destroy: () => void;
  setVisible: (visible: boolean) => void;
}

interface Options {
  map: L.Map;
  minZoom?: number;
  debounceMs?: number;
  onStatusChange?: (status: ParcelStatus) => void;
}

export type ParcelStatus =
  | { kind: "idle" }
  | { kind: "hidden-zoom"; minZoom: number }
  | { kind: "hidden-area" }
  | { kind: "loading" }
  | { kind: "ready"; landParcels: number; finalPlots: number }
  | { kind: "error"; message: string };

const LAND_PARCEL_STYLE: L.PathOptions = {
  color: "#c1121f",
  weight: 1,
  opacity: 0.9,
  fillColor: "#ef233c",
  fillOpacity: 0.22,
};

const FINAL_PLOT_STYLE: L.PathOptions = {
  color: "#003049",
  weight: 1.2,
  opacity: 0.95,
  fillColor: "#669bbc",
  fillOpacity: 0.15,
  dashArray: "4,2",
};

/**
 * Attach a live ArcGIS parcel overlay to a Leaflet map.
 * Fetches Mumbai Land Parcels + Final Plots as GeoJSON on every move.
 * Only renders when zoom >= minZoom AND the current extent is under ~5km.
 */
export function attachArcGISParcelOverlay(options: Options): ArcGISParcelOverlayHandle {
  const { map, minZoom = 15, debounceMs = 400, onStatusChange } = options;

  const landParcelsLayer = L.geoJSON(undefined, {
    style: () => LAND_PARCEL_STYLE,
    onEachFeature: (feat, layer) => {
      const p = (feat.properties ?? {}) as Record<string, unknown>;
      const lines: string[] = [];
      if (p.CTS_CS_NO) lines.push(`<strong>CTS:</strong> ${p.CTS_CS_NO}`);
      if (p.VILLAGE) lines.push(`<strong>Village:</strong> ${p.VILLAGE}`);
      if (p.WARD) lines.push(`<strong>Ward:</strong> ${p.WARD}`);
      if (p.AREA_APP_SQ_MTRS) lines.push(`<strong>Area:</strong> ${p.AREA_APP_SQ_MTRS} m²`);
      if (lines.length) {
        layer.bindTooltip(lines.join("<br/>"), { sticky: true, direction: "top" });
      }
    },
  });

  const finalPlotsLayer = L.geoJSON(undefined, {
    style: () => FINAL_PLOT_STYLE,
    onEachFeature: (feat, layer) => {
      const p = (feat.properties ?? {}) as Record<string, unknown>;
      const lines: string[] = [];
      if (p.FP_NO) lines.push(`<strong>Final Plot:</strong> ${p.FP_NO}`);
      if (p.TPS_NAME) lines.push(`<strong>TPS:</strong> ${p.TPS_NAME}`);
      if (p.VILLAGE) lines.push(`<strong>Village:</strong> ${p.VILLAGE}`);
      if (p.AREA_APP_SQ_MTRS) lines.push(`<strong>Area:</strong> ${p.AREA_APP_SQ_MTRS} m²`);
      if (lines.length) {
        layer.bindTooltip(lines.join("<br/>"), { sticky: true, direction: "top" });
      }
    },
  });

  const group = L.layerGroup([finalPlotsLayer, landParcelsLayer]);
  let visible = true;
  group.addTo(map);

  let abortController: AbortController | null = null;
  let debounceTimer: number | null = null;

  const setStatus = (s: ParcelStatus) => onStatusChange?.(s);

  const run = async () => {
    if (!visible) return;
    const zoom = map.getZoom();
    if (zoom < minZoom) {
      landParcelsLayer.clearLayers();
      finalPlotsLayer.clearLayers();
      setStatus({ kind: "hidden-zoom", minZoom });
      return;
    }
    const bounds = map.getBounds();
    if (bboxTooLarge(bounds)) {
      landParcelsLayer.clearLayers();
      finalPlotsLayer.clearLayers();
      setStatus({ kind: "hidden-area" });
      return;
    }

    abortController?.abort();
    abortController = new AbortController();
    setStatus({ kind: "loading" });

    try {
      const [landParcels, finalPlots] = await Promise.all([
        fetchGeoJSON(LAND_PARCELS_URL, bounds, LAND_PARCEL_FIELDS, abortController.signal),
        fetchGeoJSON(FINAL_PLOTS_URL, bounds, FINAL_PLOT_FIELDS, abortController.signal).catch(
          () => null
        ),
      ]);

      landParcelsLayer.clearLayers();
      finalPlotsLayer.clearLayers();

      if (landParcels) landParcelsLayer.addData(landParcels);
      if (finalPlots) finalPlotsLayer.addData(finalPlots);

      setStatus({
        kind: "ready",
        landParcels: landParcels?.features.length ?? 0,
        finalPlots: finalPlots?.features.length ?? 0,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setStatus({ kind: "error", message: err?.message ?? "Failed to load parcels" });
    }
  };

  const scheduleRun = () => {
    if (debounceTimer != null) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(run, debounceMs);
  };

  map.on("moveend", scheduleRun);
  map.on("zoomend", scheduleRun);

  // Fire the initial load immediately so the user isn't stuck on "Loading…"
  // for the debounce window on mount.
  void run();

  return {
    layer: group,
    refresh: () => scheduleRun(),
    destroy: () => {
      map.off("moveend", scheduleRun);
      map.off("zoomend", scheduleRun);
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
      abortController?.abort();
      group.remove();
    },
    setVisible: (v: boolean) => {
      visible = v;
      if (v) {
        group.addTo(map);
        scheduleRun();
      } else {
        group.remove();
        landParcelsLayer.clearLayers();
        finalPlotsLayer.clearLayers();
        setStatus({ kind: "idle" });
      }
    },
  };
}
