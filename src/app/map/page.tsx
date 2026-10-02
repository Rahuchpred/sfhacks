"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CampusMap } from "@/components/map/campus-map";
import { DetailPanel } from "@/components/map/event-detail";
import { EventList } from "@/components/map/event-list";
import { Filters } from "@/components/map/filters";
import { countLabel, type Selection } from "@/components/map/map-utils";
import { useEventFilters, useNow } from "@/components/map/use-event-filters";
import { useFreshIds } from "@/components/map/use-fresh-ids";
import { useCampus } from "@/lib/use-campus";

// Event list on the left, map on the right. On a phone the map sits on top of the list.
export default function MapPage() {
  const { buildings, events, rescues, loading, error } = useCampus();
  const now = useNow();
  const filters = useEventFilters({ buildings, events, rescues, now });

  const [rawSelection, setSelection] = useState<Selection>(null);
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);

  // A selection only counts while its item is still visible under the current filters.
  const selectedEvent =
    rawSelection?.kind === "event"
      ? filters.events.find((event) => event.id === rawSelection.id)
      : undefined;
  const selectedRescue =
    rawSelection?.kind === "rescue"
      ? filters.rescues.find((rescue) => rescue.id === rawSelection.id)
      : undefined;
  const buildingHasItems =
    rawSelection?.kind === "building" &&
    (filters.events.some((event) => event.buildingId === rawSelection.id) ||
      filters.rescues.some((rescue) => rescue.buildingId === rawSelection.id));
  const selectedBuildingId =
    selectedEvent?.buildingId ??
    selectedRescue?.buildingId ??
    (buildingHasItems ? rawSelection.id : null);
  const selection = selectedBuildingId ? rawSelection : null;

  const allIds = useMemo(
    () => [...events.map((event) => event.id), ...rescues.map((rescue) => rescue.id)],
    [events, rescues],
  );
  const freshIds = useFreshIds(allIds, !loading && !error, now);

  // Announce live arrivals once each, with a shortcut to the new pin.
  const announced = useRef(new Set<string>());
  useEffect(() => {
    for (const id of freshIds) {
      if (announced.current.has(id)) continue;
      announced.current.add(id);
      const event = events.find((item) => item.id === id);
      const rescue = rescues.find((item) => item.id === id);
      if (event) {
        toast(`New event: ${event.title}`, {
          action: { label: "Show", onClick: () => setSelection({ kind: "event", id }) },
        });
      } else if (rescue) {
        toast(`Free food just posted: ${rescue.items}`, {
          action: { label: "Show", onClick: () => setSelection({ kind: "rescue", id }) },
        });
      }
    }
  }, [freshIds, events, rescues]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelection(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const shown =
    countLabel(filters.events.length, "event") +
    (filters.rescues.length > 0 ? `, ${countLabel(filters.rescues.length, "food rescue")}` : "");
  const status = error
    ? "Could not load"
    : loading
      ? "Loading…"
      : filters.active
        ? `${shown} of ${events.length + rescues.length}`
        : shown;

  return (
    <div className="absolute inset-0 flex touch-manipulation flex-col md:flex-row">
      <aside className="order-2 flex h-[52%] min-h-0 flex-col border-t md:order-1 md:h-auto md:w-96 md:shrink-0 md:border-t-0 md:border-r">
        <div className="flex items-baseline justify-between gap-3 border-b px-5 py-2.5 md:block md:py-4">
          <h1 className="shrink-0 text-base font-semibold tracking-tight md:text-lg">Happening on campus</h1>
          <p role="status" className="truncate text-sm text-muted-foreground tabular-nums md:mt-0.5">
            {status}
          </p>
        </div>

        <Filters filters={filters} />

        <EventList
          buildings={buildings}
          events={filters.events}
          rescues={filters.rescues}
          selection={selection}
          hoveredBuildingId={hoveredBuildingId}
          freshIds={freshIds}
          now={now}
          loading={loading}
          error={error}
          filtersActive={filters.active}
          onClearFilters={filters.clear}
          onSelect={setSelection}
          onHoverBuilding={setHoveredBuildingId}
        />
      </aside>

      <div className="relative order-1 min-h-0 flex-1 md:order-2">
        <CampusMap
          buildings={buildings}
          events={filters.events}
          rescues={filters.rescues}
          selection={selection}
          selectedBuildingId={selectedBuildingId}
          hoveredBuildingId={hoveredBuildingId}
          freshIds={freshIds}
          onSelect={setSelection}
          onHoverBuilding={setHoveredBuildingId}
        />
      </div>

      <DetailPanel
        selection={selection}
        buildings={buildings}
        events={filters.events}
        rescues={filters.rescues}
        now={now}
        onSelect={setSelection}
      />
    </div>
  );
}
