"use client";

// Two map layers that make the campus feel alive, both drawn inside <CampusMap>:
// - BusyHeat: a soft purple heat where students are right now, from the real class
//   schedule and live check-ins (GET /api/campus/busy). No other campus map has this data.
// - LiveGlow: a glow under every building with an event happening now (purple) or open
//   free food (gold). With 3D on, the glow rises as a light column out of the building.

import { useEffect, useState } from "react";
import { useMap } from "@/components/ui/map";
import type { BusyNow } from "@/lib/busy";
import type { Building } from "@/lib/types";

const PURPLE = "#7a66ad";
const GOLD = "#e0b23a";
const REFRESH_MS = 60_000;

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, number | string>>;

function collection(features: Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

// Puts a layer under the first label layer, so street and building names stay readable.
function firstLabelId(map: maplibregl.Map): string | undefined {
  return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id;
}

// Adds or refreshes one GeoJSON source and keeps it across map type changes.
function setSource(map: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(id, { type: "geojson", data });
}

function removeAll(map: maplibregl.Map, layers: string[], source: string) {
  try {
    for (const layer of layers) if (map.getLayer(layer)) map.removeLayer(layer);
    if (map.getSource(source)) map.removeSource(source);
  } catch {
    // The style may already be gone when the map type changes.
  }
}

// Loads how busy each building is, and refreshes it every minute.
export function useBusyNow(enabled: boolean): BusyNow | null {
  const [busy, setBusy] = useState<BusyNow | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () =>
      fetch("/api/campus/busy")
        .then((response) => (response.ok ? (response.json() as Promise<BusyNow>) : null))
        .then((data) => {
          if (!cancelled && data) setBusy(data);
        })
        .catch(() => {
          // The heat is a bonus. Without it the map works as before.
        });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return enabled ? busy : null;
}

const HEAT_SOURCE = "gator-busy";
const HEAT_LAYERS = ["gator-busy-heat"];

export function BusyHeat({ busy, buildings }: { busy: BusyNow | null; buildings: Building[] }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    if (!busy || busy.max === 0) {
      removeAll(map, HEAT_LAYERS, HEAT_SOURCE);
      return;
    }
    const byId = new Map(buildings.map((building) => [building.id, building]));
    const features: Feature[] = busy.buildings.flatMap((row) => {
      const building = byId.get(row.buildingId);
      if (!building) return [];
      return [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [building.lng, building.lat] },
          // Square root, so one huge lecture hall does not hide every other building.
          properties: { weight: Math.sqrt(row.total / busy.max) },
        },
      ];
    });
    setSource(map, HEAT_SOURCE, collection(features));
    if (!map.getLayer(HEAT_LAYERS[0])) {
      map.addLayer(
        {
          id: HEAT_LAYERS[0],
          type: "heatmap",
          source: HEAT_SOURCE,
          paint: {
            "heatmap-weight": ["get", "weight"],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 14, 0.8, 18, 1.6],
            "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 14, 22, 16, 60, 18, 190],
            "heatmap-opacity": 0.55,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(122, 102, 173, 0)",
              0.25,
              "rgba(122, 102, 173, 0.35)",
              0.6,
              "rgba(98, 74, 160, 0.6)",
              1,
              "rgba(70, 48, 119, 0.8)",
            ],
          },
        },
        firstLabelId(map),
      );
    }
  }, [map, isLoaded, busy, buildings]);

  useEffect(() => {
    return () => {
      if (map) removeAll(map, HEAT_LAYERS, HEAT_SOURCE);
    };
  }, [map]);

  return null;
}

const GLOW_SOURCE = "gator-live-glow";
const GLOW_LAYERS = ["gator-live-glow-halo", "gator-live-glow-beam"];

// A circle as a polygon, radius in meters, for the 3D light column.
function ring(lng: number, lat: number, meters: number): number[][] {
  const points: number[][] = [];
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let step = 0; step <= 32; step += 1) {
    const angle = (step / 32) * Math.PI * 2;
    points.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return points;
}

export type GlowSpot = { buildingId: string; kind: "event" | "food" };

export function LiveGlow({
  spots,
  buildings,
  tilt,
}: {
  spots: GlowSpot[];
  buildings: Building[];
  tilt: boolean;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    const byId = new Map(buildings.map((building) => [building.id, building]));
    const features: Feature[] = spots.flatMap(({ buildingId, kind }, index) => {
      const building = byId.get(buildingId);
      if (!building) return [];
      // Event and food at one building sit side by side, like their pins.
      const shift = spots.some((other) => other.buildingId === buildingId && other.kind !== kind)
        ? (kind === "event" ? -1 : 1) * 0.00012
        : 0;
      const lng = building.lng + shift;
      const color = kind === "food" ? GOLD : PURPLE;
      return [
        {
          type: "Feature",
          id: index,
          geometry: { type: "Point", coordinates: [lng, building.lat] },
          properties: { color, shape: "halo" },
        },
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [ring(lng, building.lat, 14)] },
          properties: { color, shape: "beam" },
        },
      ];
    });
    setSource(map, GLOW_SOURCE, collection(features));
    const below = firstLabelId(map);
    if (!map.getLayer(GLOW_LAYERS[0])) {
      map.addLayer(
        {
          id: GLOW_LAYERS[0],
          type: "circle",
          source: GLOW_SOURCE,
          filter: ["==", ["get", "shape"], "halo"],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 14, 10, 17, 46, 19, 140],
            "circle-blur": 1,
            "circle-opacity": 0.7,
            "circle-pitch-alignment": "map",
          },
        },
        below,
      );
    }
    if (!map.getLayer(GLOW_LAYERS[1])) {
      map.addLayer({
        id: GLOW_LAYERS[1],
        type: "fill-extrusion",
        source: GLOW_SOURCE,
        filter: ["==", ["get", "shape"], "beam"],
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": 90,
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.55,
        },
      });
    }
    // The light column only makes sense with the camera tilted.
    map.setLayoutProperty(GLOW_LAYERS[1], "visibility", tilt ? "visible" : "none");
  }, [map, isLoaded, spots, buildings, tilt]);

  useEffect(() => {
    return () => {
      if (map) removeAll(map, GLOW_LAYERS, GLOW_SOURCE);
    };
  }, [map]);

  return null;
}
