"use client";

import { CampusMap } from "@/components/map/campus-map";
import { useNow } from "@/components/map/use-event-filters";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";

const NO_FRESH: ReadonlySet<string> = new Set();
const noop = () => {};
// The preview matches the dark page and shows off the 3D buildings.
const LOOK = { id: "dark", tilt: true, busy: false } as const;

type EmbeddedMapProps = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
};

// The real campus map with live pins, shown read-only. The card around it is
// inert, so the map never takes the scroll or a drag: a click goes to /map.
// Nothing here can be pressed, so the zoom and compass buttons are hidden and
// the credits are one quiet line instead of a white box over the pins.
const PREVIEW_CLASS = [
  "size-full",
  "[&_div:has(>div>button[aria-label='Zoom_in'])]:hidden",
  "[&_.maplibregl-ctrl-attrib-button]:hidden!",
  "[&_.maplibregl-ctrl-attrib]:m-2! [&_.maplibregl-ctrl-attrib]:min-h-0! [&_.maplibregl-ctrl-attrib]:bg-black/55! [&_.maplibregl-ctrl-attrib]:px-2! [&_.maplibregl-ctrl-attrib]:py-0.5!",
  "[&_.maplibregl-ctrl-attrib]:text-[0.625rem] [&_.maplibregl-ctrl-attrib]:leading-4 [&_.maplibregl-ctrl-attrib]:text-white/70! [&_.maplibregl-ctrl-attrib_a]:text-white/70!",
].join(" ");

export default function EmbeddedMap({ buildings, events, rescues }: EmbeddedMapProps) {
  const now = useNow();

  return (
    <div className={PREVIEW_CLASS}>
      <CampusMap
        buildings={buildings}
        events={events}
        rescues={rescues}
        selection={null}
        selectedBuildingId={null}
        hover={null}
        freshIds={NO_FRESH}
        now={now}
        onSelect={noop}
        onHover={noop}
        look={LOOK}
      />
    </div>
  );
}
