"use client";

// Mobbin reference: GetYourGuide map view (web), a result list whose rows light up their pin.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarX, TriangleAlert, Utensils, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";
import { mainCategory } from "./categories";
import {
  countLabel,
  dayLabel,
  formatTime,
  isHappeningNow,
  isHovered,
  placeLabel,
  type Hover,
  type Selection,
} from "./map-utils";

type EventListProps = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
  selection: Selection;
  hover: Hover;
  freshIds: ReadonlySet<string>;
  now: number;
  loading: boolean;
  error: string | null;
  filtersActive: boolean;
  onClearFilters: () => void;
  onSelect: (selection: Selection) => void;
  onHover: (hover: Hover) => void;
};

const rowClass =
  "scroll-mt-8 border-l-4 transition-colors duration-150 motion-reduce:transition-none";
const mainClass =
  "flex w-full cursor-pointer items-start gap-3 pt-3 pr-4 pb-1.5 pl-3 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset";
const extrasClass = "flex flex-wrap items-center gap-1.5 pr-4 pb-3 pl-[3.25rem]";
const linkClass =
  "inline-flex h-5 items-center gap-0.5 rounded-full px-1 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

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

// The same icon the pin shows, so a row and its pin read as one thing.
function RowIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: "event" | "food" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
        tone === "food" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function EventList({
  buildings,
  events,
  rescues,
  selection,
  hover,
  freshIds,
  now,
  loading,
  error,
  filtersActive,
  onClearFilters,
  onSelect,
  onHover,
}: EventListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedId = selection && selection.kind !== "building" ? selection.id : null;
  // A pin that holds one item points at one row. Bring that row into view too.
  const pointedId = hover?.source === "map" ? (hover.id ?? null) : null;

  useEffect(() => {
    const id = pointedId ?? selectedId;
    if (!id) return;
    const row = listRef.current?.querySelector(`[data-row="${id}"]`);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [selectedId, pointedId]);

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
          <div key={index} className="flex gap-3 py-3.5 pr-4 pl-4">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
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
        {!filtersActive && (
          <p className="text-sm text-muted-foreground">
            New events show up here the moment a club posts them.
          </p>
        )}
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

  // Hovering or focusing anywhere in a row lights up its pin.
  const hoverProps = (kind: "event" | "rescue", buildingId: string, id: string) => ({
    onMouseEnter: () => onHover({ kind, buildingId, id, source: "list" }),
    onMouseLeave: () => onHover(null),
    onFocus: () => onHover({ kind, buildingId, id, source: "list" }),
    onBlur: () => onHover(null),
  });

  return (
    <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {rescues.length > 0 && (
        <section aria-label="Free food right now">
          <SectionHeading>Free food right now</SectionHeading>
          <ul className="divide-y">
            {rescues.map((rescue) => {
              const selected = selectedId === rescue.id;
              const pointed = isHovered(hover, "rescue", rescue.buildingId, rescue.id);
              return (
                <li
                  key={rescue.id}
                  data-row={rescue.id}
                  {...hoverProps("rescue", rescue.buildingId, rescue.id)}
                  className={cn(
                    rowClass,
                    "border-l-accent",
                    selected ? "bg-accent/25" : pointed ? "bg-accent/15" : "hover:bg-accent/10",
                  )}
                >
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect({ kind: "rescue", id: rescue.id })}
                    className={mainClass}
                  >
                    <RowIcon icon={Utensils} tone="food" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 text-sm font-medium break-words">
                          {rescue.items}
                        </span>
                        {freshIds.has(rescue.id) && <NewBadge />}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {placeLabel(buildingById.get(rescue.buildingId), rescue.room)}
                      </span>
                    </span>
                  </button>
                  <div className={extrasClass}>
                    <Badge className="bg-accent text-accent-foreground tabular-nums">
                      {countLabel(rescue.portionsLeft, "portion")} left
                    </Badge>
                    <Badge variant="outline">Safe until {formatTime(rescue.safeUntil)}</Badge>
                    {rescue.eventId && (
                      <Link
                        href={`/events/${rescue.eventId}`}
                        aria-label={`Open the event this food is from: ${rescue.items}`}
                        className={linkClass}
                      >
                        Event
                        <ArrowUpRight aria-hidden className="size-3.5" />
                      </Link>
                    )}
                  </div>
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
              const pointed = isHovered(hover, "event", event.buildingId, event.id);
              const live = isHappeningNow(event, now);
              return (
                <li
                  key={event.id}
                  data-row={event.id}
                  {...hoverProps("event", event.buildingId, event.id)}
                  className={cn(
                    rowClass,
                    selected
                      ? "border-l-primary bg-secondary"
                      : pointed
                        ? "border-l-primary bg-primary/10"
                        : "border-l-transparent hover:bg-muted",
                  )}
                >
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect({ kind: "event", id: event.id })}
                    className={mainClass}
                  >
                    <RowIcon icon={mainCategory(event).icon} tone="event" />
                    <span className="min-w-0 flex-1">
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
                    </span>
                  </button>
                  <div className={extrasClass}>
                    {event.hasFood && event.foodItems.length === 0 && (
                      <Badge className="bg-accent text-accent-foreground">Free food</Badge>
                    )}
                    {event.hasFood &&
                      event.foodItems.map((item) => (
                        <Badge key={item} className="bg-accent text-accent-foreground capitalize">
                          {item}
                        </Badge>
                      ))}
                    {event.clubId ? (
                      <Badge
                        variant="secondary"
                        className="max-w-full"
                        render={<Link href={`/clubs/${event.clubId}`} />}
                      >
                        <span className="truncate">{event.clubName}</span>
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="max-w-full">
                        <span className="truncate">{event.clubName}</span>
                      </Badge>
                    )}
                    <Link
                      href={`/events/${event.id}`}
                      aria-label={`Open event page: ${event.title}`}
                      className={linkClass}
                    >
                      Details
                      <ArrowUpRight aria-hidden className="size-3.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
