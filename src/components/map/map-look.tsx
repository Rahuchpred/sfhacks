"use client";

// Mobbin reference: Google Maps "Map type" picker (web), a small layers button that opens
// a row of thumbnails.

import { useEffect, useSyncExternalStore } from "react";
import { Box, Check, Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMap } from "@/components/ui/map";
import { cn } from "@/lib/utils";

// Every look is a free OpenFreeMap style. They share one data schema, so the 3D
// building layer below works on all of them.
export const MAP_LOOKS = [
  {
    id: "light",
    label: "Light",
    url: "https://tiles.openfreemap.org/styles/positron",
    swatch: ["#f2f1ee", "#dcdad4", "#ffffff"],
    building: "#d9d2ea",
  },
  {
    id: "dark",
    label: "Dark",
    url: "https://tiles.openfreemap.org/styles/dark",
    swatch: ["#16161a", "#2b2b33", "#3d3d48"],
    building: "#463077",
  },
  {
    id: "streets",
    label: "Streets",
    url: "https://tiles.openfreemap.org/styles/liberty",
    swatch: ["#f4efe3", "#bfe0a8", "#f7c66b"],
    building: "#cdbfe6",
  },
  {
    id: "bright",
    label: "Bright",
    url: "https://tiles.openfreemap.org/styles/bright",
    swatch: ["#f8f4f0", "#a0c8f0", "#ffd98a"],
    building: "#cdbfe6",
  },
] as const;

export type MapLookId = (typeof MAP_LOOKS)[number]["id"];
export type MapLook = { id: MapLookId; tilt: boolean };

export const DEFAULT_LOOK: MapLook = { id: "light", tilt: false };

export function lookById(id: MapLookId) {
  return MAP_LOOKS.find((look) => look.id === id) ?? MAP_LOOKS[0];
}

// The visitor's choice, kept in this browser.
const KEY = "gator-radar:map-look";
const listeners = new Set<() => void>();
let cached: { raw: string | null; look: MapLook } = { raw: null, look: DEFAULT_LOOK };

function read(): MapLook {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // No storage: the default look is used.
  }
  if (raw === cached.raw) return cached.look;
  let look = DEFAULT_LOOK;
  try {
    const saved = raw ? (JSON.parse(raw) as Partial<MapLook>) : null;
    if (saved && MAP_LOOKS.some((item) => item.id === saved.id)) {
      look = { id: saved.id as MapLookId, tilt: saved.tilt === true };
    }
  } catch {
    // A broken value falls back to the default.
  }
  cached = { raw, look };
  return look;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function save(look: MapLook) {
  try {
    localStorage.setItem(KEY, JSON.stringify(look));
  } catch {
    // Without storage the choice lasts until the next change only.
    cached = { raw: cached.raw, look };
  }
  listeners.forEach((listener) => listener());
}

export function useMapLook(): [MapLook, (look: MapLook) => void] {
  const look = useSyncExternalStore(subscribe, read, () => DEFAULT_LOOK);
  return [look, save];
}

const LAYER_ID = "gator-3d-buildings";
const TILT = { pitch: 56, bearing: -18 };

// Draws the buildings as 3D blocks and tilts the camera. Lives inside <Map>.
export function Buildings3D({ enabled, color }: { enabled: boolean; color: string }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = still ? 0 : 700;

    if (!enabled) {
      if (map.getPitch() !== 0 || map.getBearing() !== 0) {
        map.easeTo({ pitch: 0, bearing: 0, duration });
      }
      return;
    }

    // Between two looks the map has no style for a moment: wait for the next load.
    const style = map.getStyle() as ReturnType<typeof map.getStyle> | undefined;
    if (!style?.layers) return;
    // Some styles (Streets) ship their own 3D buildings. Hide those so ours match the look.
    const own = style.layers.filter(
      (layer) => layer.type === "fill-extrusion" && layer.id !== LAYER_ID,
    );
    own.forEach((layer) => map.setLayoutProperty(layer.id, "visibility", "none"));

    const source = Object.entries(style.sources).find(([, value]) => value.type === "vector")?.[0];
    // Under the first label layer, so names stay readable.
    const firstLabel = style.layers.find((layer) => layer.type === "symbol")?.id;
    if (source && !map.getLayer(LAYER_ID)) {
      map.addLayer(
        {
          id: LAYER_ID,
          type: "fill-extrusion",
          source,
          "source-layer": "building",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": color,
            // Campus buildings are low, so heights are stretched a little to read as 3D.
            "fill-extrusion-height": ["*", 1.6, ["coalesce", ["get", "render_height"], 10]],
            "fill-extrusion-base": ["*", 1.6, ["coalesce", ["get", "render_min_height"], 0]],
            "fill-extrusion-opacity": 0.88,
          },
        },
        firstLabel,
      );
    }
    map.easeTo({ ...TILT, duration });

    return () => {
      // The style may already be gone when the look changes.
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        own.forEach((layer) => {
          if (map.getLayer(layer.id)) map.setLayoutProperty(layer.id, "visibility", "visible");
        });
      } catch {
        // Nothing to clean on a removed map.
      }
    };
  }, [map, isLoaded, enabled, color]);

  return null;
}

// The floating button that changes the map type and turns 3D on or off.
export function MapLookPicker({
  look,
  onChange,
  className,
}: {
  look: MapLook;
  onChange: (look: MapLook) => void;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Map type"
            className={cn(
              "flex size-8 items-center justify-center rounded-md border bg-background text-foreground shadow-sm transition-[background-color,scale] duration-150 ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.96] motion-reduce:transition-none",
              className,
            )}
          />
        }
      >
        <Layers aria-hidden className="size-4" />
      </PopoverTrigger>
      <PopoverContent side="left" align="start" sideOffset={8} className="w-64 gap-3 p-3">
        <p className="text-xs font-medium text-muted-foreground">Map type</p>
        <div role="radiogroup" aria-label="Map type" className="grid grid-cols-4 gap-2">
          {MAP_LOOKS.map((item) => {
            const active = item.id === look.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...look, id: item.id })}
                className="group flex flex-col items-center gap-1.5 rounded-md text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "relative flex h-11 w-full items-center justify-center overflow-hidden rounded-md border transition-[border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
                    active ? "border-primary ring-2 ring-primary/30" : "group-hover:border-primary/50",
                  )}
                  style={{ backgroundColor: item.swatch[0] }}
                >
                  {/* A tiny abstract map: a block and a road. */}
                  <span
                    aria-hidden
                    className="absolute top-1.5 left-1.5 size-4 rounded-[3px]"
                    style={{ backgroundColor: item.swatch[1] }}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-2.5 h-1 -rotate-6"
                    style={{ backgroundColor: item.swatch[2] }}
                  />
                  {active && (
                    <span className="relative flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check aria-hidden className="size-3" />
                    </span>
                  )}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={look.tilt}
          onClick={() => onChange({ ...look, tilt: !look.tilt })}
          className="flex h-9 items-center justify-between gap-2 rounded-md border px-2.5 text-sm font-medium transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          <span className="flex items-center gap-2">
            <Box aria-hidden className="size-4" />
            3D buildings
          </span>
          <span
            aria-hidden
            className={cn(
              "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-150 motion-reduce:transition-none",
              look.tilt ? "bg-primary" : "bg-input",
            )}
          >
            <span
              className={cn(
                "size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out motion-reduce:transition-none",
                look.tilt && "translate-x-4",
              )}
            />
          </span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
