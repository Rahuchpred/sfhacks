"use client";

// Mobbin reference: GetYourGuide map view (web), labelled pins linked to the list beside them.
// The map itself is the mapcn component (src/components/ui/map.tsx) on MapLibre.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Map, MapControls, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import { Utensils } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";
import { EventPin, FoodPin } from "./building-pin";
import {
  Buildings3D,
  lookById,
  MapLookPicker,
  useMapLook,
  type MapLook,
} from "./map-look";
import { mainCategory } from "./categories";
import {
  countLabel,
  formatTime,
  formatTimeRange,
  groupByBuilding,
  type Hover,
  type Selection,
} from "./map-utils";

const SFSU_CENTER: [number, number] = [-122.4793, 37.7229];
const START_ZOOM = 15.6;
const FOCUS_ZOOM = 17;
// On wide screens the detail panel covers the left edge of the map, so focus right of it.
const DETAIL_PANEL_WIDTH = 416;
const MAX_PIN_ICONS = 3;

type CampusMapProps = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
  selection: Selection;
  selectedBuildingId: string | null;
  hover: Hover;
  freshIds: ReadonlySet<string>;
  now: number;
  onSelect: (selection: Selection) => void;
  onHover: (hover: Hover) => void;
  children?: React.ReactNode; // extra markers, drawn inside the map
  // A fixed look with no picker, for read-only previews. Without it the visitor chooses.
  look?: MapLook;
};

type PinKind = "event" | "rescue";

const optionClass =
  "flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

// One purple pin per building showing what kind of event is there, plus a gold pin where
// food is open. A pin holding several items opens a short list to pick from.
export function CampusMap({
  buildings,
  events,
  rescues,
  selection,
  selectedBuildingId,
  hover,
  freshIds,
  now,
  onSelect,
  onHover,
  children,
  look: fixedLook,
}: CampusMapProps) {
  const [savedLook, setLook] = useMapLook();
  const look = fixedLook ?? savedLook;
  const lookStyle = lookById(look.id);
  const styles = useMemo(() => ({ light: lookStyle.url, dark: lookStyle.url }), [lookStyle.url]);
  const [openPin, setOpenPin] = useState<{ kind: PinKind; buildingId: string } | null>(null);
  const groups = useMemo(
    () => groupByBuilding(buildings, events, rescues),
    [buildings, events, rescues],
  );

  const target = buildings.find((building) => building.id === selectedBuildingId);

  function pick(next: Selection) {
    setOpenPin(null);
    onHover(null);
    onSelect(next);
  }

  return (
    <Map
      center={SFSU_CENTER}
      zoom={START_ZOOM}
      theme="light"
      styles={styles}
      maxPitch={70}
    >
      <MapControls position="top-right" showZoom showCompass={look.tilt} />
      {!fixedLook && (
        <MapLookPicker look={look} onChange={setLook} className="absolute top-2 right-12 z-10" />
      )}
      <Buildings3D enabled={look.tilt} color={lookStyle.building} />
      <ClearOnMapClick onClear={() => onSelect(null)} />
      <FlyToBuilding lng={target?.lng} lat={target?.lat} />

      {groups.map((group) => {
        const { building } = group;
        const both = group.events.length > 0 && group.rescues.length > 0;
        const isSelected = building.id === selectedBuildingId;

        // Shared by both pins of a building: which one is lit, and what its label says.
        function pinState(kind: PinKind, titles: { id: string; title: string }[]) {
          const mine = hover?.kind === kind && hover.buildingId === building.id;
          const open = openPin?.kind === kind && openPin.buildingId === building.id;
          const selected =
            isSelected && selection !== null && selection.kind !== (kind === "event" ? "rescue" : "event");
          const picked =
            selection && selection.kind === kind
              ? titles.find((item) => item.id === selection.id)
              : undefined;
          const pointed = mine && hover.id ? titles.find((item) => item.id === hover.id) : undefined;
          const hint = open
            ? null
            : mine
              ? (pointed?.title ??
                (titles.length === 1 ? titles[0].title : (picked?.title ?? building.name)))
              : selected
                ? (picked?.title ?? building.name)
                : null;
          return {
            hint,
            selected,
            hovered: mine || open,
            dimmed: hover?.source === "list" && !mine,
            zIndex: mine || open ? 3 : selected ? 2 : 1,
            open,
            onHover: (hovering: boolean) =>
              onHover(
                hovering
                  ? {
                      kind,
                      buildingId: building.id,
                      id: titles.length === 1 ? titles[0].id : undefined,
                      source: "map",
                    }
                  : null,
              ),
            onOpenChange: (next: boolean) =>
              setOpenPin(next ? { kind, buildingId: building.id } : null),
          };
        }

        const eventPin = pinState("event", group.events);
        const foodPin = pinState(
          "rescue",
          group.rescues.map((rescue) => ({ id: rescue.id, title: rescue.items })),
        );
        const icons = [...new Set(group.events.map((event) => mainCategory(event).icon))].slice(
          0,
          MAX_PIN_ICONS,
        );

        const eventButton = (
          <EventPin
            icons={icons}
            count={group.events.length}
            hasFood={group.events.some((event) => event.hasFood)}
            label={
              group.events.length === 1
                ? `${group.events[0].title}, ${building.name}`
                : `${building.name}, ${countLabel(group.events.length, "event")}`
            }
            hint={eventPin.hint}
            selected={eventPin.selected}
            hovered={eventPin.hovered}
            dimmed={eventPin.dimmed}
            fresh={group.events.some((event) => freshIds.has(event.id))}
            onHover={eventPin.onHover}
            onClick={
              group.events.length === 1
                ? () => pick({ kind: "event", id: group.events[0].id })
                : undefined
            }
          />
        );

        const foodButton = (
          <FoodPin
            count={group.rescues.length}
            label={`${building.name}, free food: ${group.rescues.map((rescue) => rescue.items).join(", ")}`}
            hint={foodPin.hint}
            selected={foodPin.selected}
            hovered={foodPin.hovered}
            dimmed={foodPin.dimmed}
            fresh={group.rescues.some((rescue) => freshIds.has(rescue.id))}
            onHover={foodPin.onHover}
            onClick={
              group.rescues.length === 1
                ? () => pick({ kind: "rescue", id: group.rescues[0].id })
                : undefined
            }
          />
        );

        return (
          <Fragment key={building.id}>
            {group.events.length > 0 && (
              <MapMarker
                longitude={building.lng}
                latitude={building.lat}
                anchor="center"
                offset={[both ? -22 : 0, 0]}
                zIndex={eventPin.zIndex}
              >
                <MarkerContent>
                {group.events.length === 1 ? (
                  eventButton
                ) : (
                  <Popover open={eventPin.open} onOpenChange={eventPin.onOpenChange}>
                    <PopoverTrigger render={eventButton} />
                    <PopoverContent side="top" sideOffset={10} className="w-72 gap-1 p-1.5">
                      <p className="truncate px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
                        {building.name}
                      </p>
                      <ul className="max-h-64 overflow-y-auto overscroll-contain">
                        {group.events.map((event) => {
                          const Icon = mainCategory(event).icon;
                          return (
                            <li key={event.id}>
                              <button
                                type="button"
                                onClick={() => pick({ kind: "event", id: event.id })}
                                onMouseEnter={() =>
                                  onHover({
                                    kind: "event",
                                    buildingId: building.id,
                                    id: event.id,
                                    source: "map",
                                  })
                                }
                                onMouseLeave={() => onHover(null)}
                                className={`${optionClass} hover:bg-muted`}
                              >
                                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                  <Icon aria-hidden className="size-3.5" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium break-words">
                                    {event.title}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    {formatTimeRange(event, now)}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </PopoverContent>
                  </Popover>
                )}
                </MarkerContent>
              </MapMarker>
            )}

            {group.rescues.length > 0 && (
              <MapMarker
                longitude={building.lng}
                latitude={building.lat}
                anchor="center"
                offset={[both ? 22 : 0, 0]}
                zIndex={foodPin.zIndex}
              >
                <MarkerContent>
                {group.rescues.length === 1 ? (
                  foodButton
                ) : (
                  <Popover open={foodPin.open} onOpenChange={foodPin.onOpenChange}>
                    <PopoverTrigger render={foodButton} />
                    <PopoverContent side="top" sideOffset={10} className="w-72 gap-1 p-1.5">
                      <p className="truncate px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
                        Free food, {building.name}
                      </p>
                      <ul className="max-h-64 overflow-y-auto overscroll-contain">
                        {group.rescues.map((rescue) => (
                          <li key={rescue.id}>
                            <button
                              type="button"
                              onClick={() => pick({ kind: "rescue", id: rescue.id })}
                              onMouseEnter={() =>
                                onHover({
                                  kind: "rescue",
                                  buildingId: building.id,
                                  id: rescue.id,
                                  source: "map",
                                })
                              }
                              onMouseLeave={() => onHover(null)}
                              className={`${optionClass} hover:bg-accent/15`}
                            >
                              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                                <Utensils aria-hidden className="size-3.5" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-medium break-words">
                                  {rescue.items}
                                </span>
                                <span className="block text-xs text-muted-foreground tabular-nums">
                                  {countLabel(rescue.portionsLeft, "portion")} left, safe until{" "}
                                  {formatTime(rescue.safeUntil)}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                )}
                </MarkerContent>
              </MapMarker>
            )}
          </Fragment>
        );
      })}
      {children}
    </Map>
  );
}

// Pins sit inside the map, so their clicks arrive at the map too. Only a click on the
// map itself clears the selection.
function ClearOnMapClick({ onClear }: { onClear: () => void }) {
  const { map } = useMap();
  const clear = useRef(onClear);
  useEffect(() => {
    clear.current = onClear;
  }, [onClear]);

  useEffect(() => {
    if (!map) return;
    const onClick = (event: { originalEvent: MouseEvent }) => {
      const clicked = event.originalEvent.target;
      if (clicked instanceof Element && clicked.closest(".maplibregl-marker")) return;
      clear.current();
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  return null;
}

// Moves the camera to the selected building, keeping the current tilt.
function FlyToBuilding({ lng, lat }: { lng: number | undefined; lat: number | undefined }) {
  const { map } = useMap();

  useEffect(() => {
    if (!map || lng === undefined || lat === undefined) return;
    const wide = map.getContainer().clientWidth > 2 * DETAIL_PANEL_WIDTH;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      offset: [wide ? DETAIL_PANEL_WIDTH / 2 : 0, 0],
      duration: still ? 0 : 900,
    });
  }, [map, lng, lat]);

  return null;
}
