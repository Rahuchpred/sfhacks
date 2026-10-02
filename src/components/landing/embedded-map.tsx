"use client";

import { CampusMap } from "@/components/map/campus-map";
import { useNow } from "@/components/map/use-event-filters";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";

const NO_FRESH: ReadonlySet<string> = new Set();
const noop = () => {};

type EmbeddedMapProps = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
};

// The real campus map with live pins, shown read-only. The card around it is
// inert, so the map never takes the scroll or a drag: a click goes to /map.
export default function EmbeddedMap({ buildings, events, rescues }: EmbeddedMapProps) {
  const now = useNow();

  return (
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
    />
  );
}
