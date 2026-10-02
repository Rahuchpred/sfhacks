"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";
import { EventPin, FoodPin } from "./building-pin";
import { countLabel, groupByBuilding, type BuildingGroup, type Selection } from "./map-utils";

const SFSU_CENTER = { longitude: -122.4793, latitude: 37.7229, zoom: 15.6 };
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const FOCUS_ZOOM = 17;
// On wide screens the detail panel covers the left edge of the map, so focus right of it.
const DETAIL_PANEL_WIDTH = 416;

type CampusMapProps = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
  selection: Selection;
  selectedBuildingId: string | null;
  hoveredBuildingId: string | null;
  freshIds: ReadonlySet<string>;
  onSelect: (selection: Selection) => void;
  onHoverBuilding: (buildingId: string | null) => void;
};

// One purple pin per building with an event count, plus a gold pin where food is open.
export function CampusMap({
  buildings,
  events,
  rescues,
  selection,
  selectedBuildingId,
  hoveredBuildingId,
  freshIds,
  onSelect,
  onHoverBuilding,
}: CampusMapProps) {
  const mapRef = useRef<MapRef>(null);
  const groups = useMemo(
    () => groupByBuilding(buildings, events, rescues),
    [buildings, events, rescues],
  );

  const target = buildings.find((building) => building.id === selectedBuildingId);
  const targetLng = target?.lng;
  const targetLat = target?.lat;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || targetLng === undefined || targetLat === undefined) return;
    const wide = map.getContainer().clientWidth > 2 * DETAIL_PANEL_WIDTH;
    map.flyTo({
      center: [targetLng, targetLat],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      offset: [wide ? DETAIL_PANEL_WIDTH / 2 : 0, 0],
      duration: 900,
    });
  }, [targetLng, targetLat]);

  function selectEvents(group: BuildingGroup) {
    onSelect(
      group.events.length === 1
        ? { kind: "event", id: group.events[0].id }
        : { kind: "building", id: group.building.id },
    );
  }

  function selectFood(group: BuildingGroup) {
    onSelect(
      group.rescues.length === 1
        ? { kind: "rescue", id: group.rescues[0].id }
        : { kind: "building", id: group.building.id },
    );
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={SFSU_CENTER}
      mapStyle={MAP_STYLE}
      attributionControl={{ compact: true }}
      style={{ width: "100%", height: "100%" }}
      onClick={() => onSelect(null)}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {groups.map((group) => {
        const { building } = group;
        const both = group.events.length > 0 && group.rescues.length > 0;
        const isSelected = building.id === selectedBuildingId;
        const isHovered = building.id === hoveredBuildingId;
        const onHover = (hovering: boolean) => onHoverBuilding(hovering ? building.id : null);

        return (
          <Fragment key={building.id}>
            {group.events.length > 0 && (
              <Marker
                longitude={building.lng}
                latitude={building.lat}
                anchor="center"
                offset={[both ? -15 : 0, 0]}
                style={{ zIndex: isSelected ? 3 : isHovered ? 2 : 1 }}
                onClick={(event) => {
                  // Keep the click from reaching the map, which would clear the selection.
                  event.originalEvent.stopPropagation();
                  selectEvents(group);
                }}
              >
                <EventPin
                  count={group.events.length}
                  hasFood={group.events.some((event) => event.hasFood)}
                  label={`${building.name}, ${countLabel(group.events.length, "event")}`}
                  selected={isSelected && selection?.kind !== "rescue"}
                  hovered={isHovered}
                  fresh={group.events.some((event) => freshIds.has(event.id))}
                  onHover={onHover}
                />
              </Marker>
            )}

            {group.rescues.length > 0 && (
              <Marker
                longitude={building.lng}
                latitude={building.lat}
                anchor="center"
                offset={[both ? 15 : 0, 0]}
                style={{ zIndex: isSelected ? 3 : isHovered ? 2 : 1 }}
                onClick={(event) => {
                  event.originalEvent.stopPropagation();
                  selectFood(group);
                }}
              >
                <FoodPin
                  label={`${building.name}, free food: ${group.rescues.map((rescue) => rescue.items).join(", ")}`}
                  selected={isSelected && selection?.kind !== "event"}
                  hovered={isHovered}
                  fresh={group.rescues.some((rescue) => freshIds.has(rescue.id))}
                  onHover={onHover}
                />
              </Marker>
            )}
          </Fragment>
        );
      })}
    </Map>
  );
}
