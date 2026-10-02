"use client";

import { useEffect, useRef } from "react";
import { CalendarX, TriangleAlert, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";
import {
  countLabel,
  dayLabel,
  formatTime,
  isHappeningNow,
  placeLabel,
  type Selection,
} from "./map-utils";

type EventListProps = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
  selection: Selection;
  hoveredBuildingId: string | null;
  freshIds: ReadonlySet<string>;
  now: number;
  loading: boolean;
  error: string | null;
  filtersActive: boolean;
  onClearFilters: () => void;
  onSelect: (selection: Selection) => void;
  onHoverBuilding: (buildingId: string | null) => void;
};

const itemClass =
  "block w-full px-5 py-3.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="sticky top-0 z-10 border-b bg-muted px-5 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

function NewBadge() {
  return <Badge className="bg-foreground text-background">New</Badge>;
}

export function EventList({
  buildings,
  events,
  rescues,
  selection,
  hoveredBuildingId,
  freshIds,
  now,
  loading,
  error,
  filtersActive,
  onClearFilters,
  onSelect,
  onHoverBuilding,
}: EventListProps) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const selectedId = selection && selection.kind !== "building" ? selection.id : null;

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  if (error) {
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <TriangleAlert aria-hidden className="size-8 text-destructive" />
        <p className="font-medium">Could not load campus events</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div aria-hidden className="min-h-0 flex-1 divide-y overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="space-y-2 px-5 py-3.5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0 && rescues.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <CalendarX aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-medium">
          {filtersActive ? "Nothing matches these filters" : "Nothing on the map yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {filtersActive
            ? "Try a wider time range or fewer tags."
            : "New events show up here the moment a club posts them."}
        </p>
        {filtersActive && (
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    );
  }

  const buildingById = new Map(buildings.map((building) => [building.id, building]));

  // Events arrive sorted by start time, so sections keep that order.
  const sections: { label: string; events: CampusEvent[] }[] = [];
  for (const event of events) {
    const label = isHappeningNow(event, now) ? "Happening now" : dayLabel(event.startsAt, now);
    const last = sections[sections.length - 1];
    if (last?.label === label) last.events.push(event);
    else sections.push({ label, events: [event] });
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {rescues.length > 0 && (
        <section aria-label="Free food right now">
          <SectionHeading>Free food right now</SectionHeading>
          <ul className="divide-y">
            {rescues.map((rescue) => {
              const selected = selectedId === rescue.id;
              return (
                <li key={rescue.id}>
                  <button
                    type="button"
                    ref={selected ? selectedRef : undefined}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect({ kind: "rescue", id: rescue.id })}
                    onMouseEnter={() => onHoverBuilding(rescue.buildingId)}
                    onMouseLeave={() => onHoverBuilding(null)}
                    onFocus={() => onHoverBuilding(rescue.buildingId)}
                    onBlur={() => onHoverBuilding(null)}
                    className={cn(
                      itemClass,
                      "border-l-4 border-l-accent",
                      selected
                        ? "bg-accent/20"
                        : hoveredBuildingId === rescue.buildingId
                          ? "bg-accent/10"
                          : "hover:bg-accent/10",
                    )}
                  >
                    <span className="flex items-start gap-2">
                      <Utensils aria-hidden className="mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1 text-sm font-medium break-words">
                        {rescue.items}
                      </span>
                      {freshIds.has(rescue.id) && <NewBadge />}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {placeLabel(buildingById.get(rescue.buildingId), rescue.room)}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <Badge className="bg-accent text-accent-foreground tabular-nums">
                        {countLabel(rescue.portionsLeft, "portion")} left
                      </Badge>
                      <Badge variant="outline">Safe until {formatTime(rescue.safeUntil)}</Badge>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sections.map((section) => (
        <section key={section.label} aria-label={section.label}>
          <SectionHeading>{section.label}</SectionHeading>
          <ul className="divide-y">
            {section.events.map((event) => {
              const selected = selectedId === event.id;
              const live = isHappeningNow(event, now);
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    ref={selected ? selectedRef : undefined}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect({ kind: "event", id: event.id })}
                    onMouseEnter={() => onHoverBuilding(event.buildingId)}
                    onMouseLeave={() => onHoverBuilding(null)}
                    onFocus={() => onHoverBuilding(event.buildingId)}
                    onBlur={() => onHoverBuilding(null)}
                    className={cn(
                      itemClass,
                      "border-l-4",
                      selected
                        ? "border-l-primary bg-secondary"
                        : hoveredBuildingId === event.buildingId
                          ? "border-l-primary/40 bg-muted"
                          : "border-l-transparent hover:bg-muted",
                    )}
                  >
                    <span className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 text-sm font-medium break-words">
                        {event.title}
                      </span>
                      {freshIds.has(event.id) && <NewBadge />}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {live
                        ? `Until ${formatTime(event.endsAt)}`
                        : `${formatTime(event.startsAt)} to ${formatTime(event.endsAt)}`}
                      {", "}
                      {placeLabel(buildingById.get(event.buildingId), event.room)}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {event.hasFood && (
                        <Badge className="bg-accent text-accent-foreground">Free food</Badge>
                      )}
                      <Badge variant="secondary" className="max-w-full">
                        <span className="truncate">{event.clubName}</span>
                      </Badge>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
