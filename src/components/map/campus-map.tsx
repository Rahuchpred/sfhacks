"use client";

import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";

const SFSU_CENTER = { longitude: -122.4793, latitude: 37.7229, zoom: 16 };
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

type CampusMapProps = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
};

// Purple pins are events, gold pins are food rescues.
export function CampusMap({ buildings, events, rescues }: CampusMapProps) {
  const byId = new globalThis.Map(buildings.map((building) => [building.id, building]));

  return (
    <Map
      initialViewState={SFSU_CENTER}
      mapStyle={MAP_STYLE}
      attributionControl={{ compact: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {events.map((event) => {
        const building = byId.get(event.buildingId);
        if (!building) return null;
        return (
          <Marker key={event.id} longitude={building.lng} latitude={building.lat} anchor="center">
            <span
              title={event.title}
              className="block size-4 rounded-full border-2 border-white bg-primary shadow-md"
            />
          </Marker>
        );
      })}

      {rescues.map((rescue) => {
        const building = byId.get(rescue.buildingId);
        if (!building) return null;
        return (
          <Marker key={rescue.id} longitude={building.lng} latitude={building.lat} anchor="center">
            <span
              title={rescue.items}
              className="block size-5 rounded-full border-2 border-white bg-accent shadow-md"
            />
          </Marker>
        );
      })}
    </Map>
  );
}
