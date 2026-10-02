"use client";

// Mobbin reference from the earlier rounds: GetYourGuide map view (web), a result list whose
// rows light up their pin. The Mobbin tool was not available in round 5, so the row design
// follows known event lists from memory: Luma discover (web) for the cover tile with the
// time above the title, Resident Advisor (web) for the date block on later days, Eventbrite
// (web) for one larger "popular" card that breaks the rhythm, Partiful (web) for the live dot.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarX, Flame, TriangleAlert } from "lucide-react";
import {
  EventTile,
  GoingCount,
  LiveDot,
  RescueTile,
  WhenLine,
} from "@/components/events/event-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";
import { mainCategory } from "./categories";
import {
  countLabel,
  dayLabel,
  durationLabel,
  formatTime,
  isHappeningNow,
  isHovered,
  liveProgress,
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

const LIVE_LABEL = "Happening now";
// The big card needs a crowd behind it and a list long enough to have a rhythm to break.
const FEATURED_MIN_GOING = 5;
const FEATURED_MIN_ROWS = 4;
const STAGGER_MS = 30;
const STAGGER_ROWS = 10;

// Rows rise in when they appear: one after another on first load, at once after a filter.
const enterClass =
  "animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none";
const rowClass =
  "scroll-mt-8 border-l-4 transition-colors duration-150 motion-reduce:transition-none";
const mainClass =
  "group flex w-full cursor-pointer items-start gap-3 pt-3 pr-4 pb-1.5 pl-3 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset";
// The cover answers the pointer: it grows a little on hover and gives on press.
const tileMotion =
  "transition-transform duration-150 ease-out group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-active:scale-100";
const titleClass = "mt-0.5 block text-sm leading-snug font-semibold break-words";
const placeClass = "mt-0.5 block text-xs break-words text-muted-foreground";
const extrasRow = "flex flex-wrap items-center gap-x-2 gap-y-1.5";
const linkClass =
  "ml-auto inline-flex h-5 items-center gap-0.5 rounded-full text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const clubClass =
  "inline-flex h-5 max-w-full min-w-0 items-center rounded-sm text-xs text-muted-foreground underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function SectionHeading({
  live = false,
  count,
  children,
}: {
  live?: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <h2 className="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted px-5 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {live && <LiveDot />}
      <span className={cn("min-w-0 flex-1 truncate", live && "text-foreground")}>{children}</span>
      <span aria-hidden className="font-medium tabular-nums">
        {count}
      </span>
    </h2>
  );
}

function NewBadge() {
  return <Badge className="bg-foreground text-background">New</Badge>;
}

function FoodChips({ event }: { event: CampusEvent }) {
  if (!event.hasFood) return null;
  if (event.foodItems.length === 0) {
    return <Badge className="bg-accent text-accent-foreground">Free food</Badge>;
  }
  return event.foodItems.map((item) => (
    <Badge key={item} className="bg-accent text-accent-foreground capitalize">
      {item}
    </Badge>
  ));
}

function ClubName({ event }: { event: CampusEvent }) {
  const name = <span className="truncate">{event.clubName}</span>;
  return event.clubId ? (
    <Link
      href={`/clubs/${event.clubId}`}
      className={cn(clubClass, "hover:text-foreground hover:underline")}
    >
      {name}
    </Link>
  ) : (
    <span className={clubClass}>{name}</span>
  );
}

// What sits under a row: who is going, the food, the club, and the way to the event page.
function EventExtras({
  event,
  live,
  className,
}: {
  event: CampusEvent;
  live: boolean;
  className: string;
}) {
  return (
    <div className={cn(extrasRow, className)}>
      <GoingCount event={event} live={live} />
      <FoodChips event={event} />
      <ClubName event={event} />
      <Link
        href={`/events/${event.id}`}
        aria-label={`Open event page: ${event.title}`}
        className={linkClass}
      >
        Details
        <ArrowUpRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}

// The event the most people are going to, when the list is long enough to feature one.
function pickFeatured(events: CampusEvent[]): string | null {
  if (events.length < FEATURED_MIN_ROWS) return null;
  let best: CampusEvent | null = null;
  for (const event of events) {
    if (event.rsvpCount >= FEATURED_MIN_GOING && event.rsvpCount > (best?.rsvpCount ?? 0)) {
      best = event;
    }
  }
  return best?.id ?? null;
}

type RowState = {
  place: string;
  selected: boolean;
  pointed: boolean;
  fresh: boolean;
  delay: number;
  now: number;
  hoverProps: React.HTMLAttributes<HTMLLIElement>;
  onSelect: () => void;
};

function EventRow({
  event,
  place,
  selected,
  pointed,
  fresh,
  delay,
  now,
  hoverProps,
  onSelect,
}: RowState & { event: CampusEvent }) {
  return (
    <li
      data-row={event.id}
      {...hoverProps}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        rowClass,
        enterClass,
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
        onClick={onSelect}
        className={mainClass}
      >
        <EventTile event={event} now={now} className={tileMotion} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <WhenLine event={event} now={now} className="min-w-0 flex-1" />
            {fresh && <NewBadge />}
          </span>
          <span className={titleClass}>{event.title}</span>
          <span className={placeClass}>{place}</span>
        </span>
      </button>
      <EventExtras
        event={event}
        live={isHappeningNow(event, now)}
        className="pr-4 pb-3 pl-[4.5rem]"
      />
    </li>
  );
}

// One larger card for the event with the biggest crowd, so the list is not all one shape.
function FeaturedRow({
  event,
  place,
  selected,
  pointed,
  fresh,
  delay,
  now,
  hoverProps,
  onSelect,
}: RowState & { event: CampusEvent }) {
  const category = mainCategory(event);
  const Icon = category.icon;
  const live = isHappeningNow(event, now);
  return (
    <li
      data-row={event.id}
      {...hoverProps}
      style={{ animationDelay: `${delay}ms` }}
      className={cn("scroll-mt-8 px-3 py-2.5", enterClass)}
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl border transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none",
          selected
            ? "border-primary bg-secondary ring-2 ring-primary/40"
            : pointed
              ? "border-primary bg-primary/10"
              : "bg-background hover:border-primary/40 hover:shadow-sm",
        )}
      >
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          onClick={onSelect}
          className="group block w-full cursor-pointer text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
        >
          <span className={cn("relative block h-14", category.tint)}>
            <span className="absolute inset-0 overflow-hidden">
              {event.flyerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.flyerUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <Icon
                  aria-hidden
                  className="absolute -right-3 -bottom-6 size-24 opacity-15 transition-transform duration-200 ease-out group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:rotate-0"
                />
              )}
            </span>
            <span className="absolute top-2 right-3 inline-flex h-5 items-center gap-1 rounded-full bg-background/95 px-2 text-xs font-semibold text-foreground">
              <Flame aria-hidden className="size-3 text-rose-600" />
              Most popular
            </span>
            {live && (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-background/70">
                <span
                  className="block h-full origin-left bg-rose-600 transition-transform duration-500 ease-linear motion-reduce:transition-none"
                  style={{ transform: `scaleX(${liveProgress(event, now)})` }}
                />
              </span>
            )}
            {/* The pin of this event, as the map draws it. */}
            <span
              aria-hidden
              className={cn(
                "absolute -bottom-4 left-3 flex size-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm",
                tileMotion,
              )}
            >
              <Icon className="size-4" />
            </span>
          </span>
          <span className="block px-3 pt-5 pb-1.5">
            <span className="flex items-start gap-2">
              <WhenLine event={event} now={now} className="min-w-0 flex-1" />
              {fresh && <NewBadge />}
            </span>
            <span className={cn(titleClass, "text-base")}>{event.title}</span>
            <span className={placeClass}>{place}</span>
          </span>
        </button>
        <EventExtras event={event} live={live} className="px-3 pb-3" />
      </div>
    </li>
  );
}

function RescueRow({
  rescue,
  place,
  selected,
  pointed,
  fresh,
  delay,
  now,
  hoverProps,
  onSelect,
}: RowState & { rescue: FoodRescue }) {
  const left = Date.parse(rescue.safeUntil) - now;
  return (
    <li
      data-row={rescue.id}
      {...hoverProps}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        rowClass,
        enterClass,
        "border-l-accent",
        selected ? "bg-accent/25" : pointed ? "bg-accent/15" : "hover:bg-accent/10",
      )}
    >
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={mainClass}
      >
        <RescueTile rescue={rescue} className={tileMotion} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-xs tabular-nums">
              <span className="font-semibold">Until {formatTime(rescue.safeUntil)}</span>
              {left > 0 && (
                <span className="text-muted-foreground">{durationLabel(left)} left</span>
              )}
            </span>
            {fresh && <NewBadge />}
          </span>
          <span className={titleClass}>{rescue.items}</span>
          <span className={placeClass}>{place}</span>
        </span>
      </button>
      <div className={cn(extrasRow, "pr-4 pb-3 pl-[4.5rem]")}>
        <Badge className="bg-accent text-accent-foreground tabular-nums">
          {countLabel(rescue.portionsLeft, "portion")} left
        </Badge>
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

  // Only the first rows to show come in one after another. Later arrivals come in at once.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => setSettled(true), STAGGER_MS * STAGGER_ROWS + 300);
    return () => clearTimeout(timer);
  }, [loading]);

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
    const pulse = "motion-reduce:animate-none";
    return (
      <div aria-hidden className="min-h-0 flex-1 divide-y overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex gap-3 py-3.5 pr-4 pl-4">
            <Skeleton className={cn("size-12 shrink-0 rounded-xl", pulse)} />
            <div className="flex-1 space-y-2">
              <Skeleton className={cn("h-3 w-2/5", pulse)} />
              <Skeleton className={cn("h-4 w-4/5", pulse)} />
              <Skeleton className={cn("h-3 w-3/5", pulse)} />
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
    const label = isHappeningNow(event, now) ? LIVE_LABEL : dayLabel(event.startsAt, now);
    const last = sections[sections.length - 1];
    if (last?.label === label) last.events.push(event);
    else sections.push({ label, events: [event] });
  }
  const featuredId = pickFeatured(events);

  // Where each row sits from the top, which sets how long it waits to come in.
  const order = new Map(
    [...rescues, ...sections.flatMap((section) => section.events)].map((item, index) => [
      item.id,
      index,
    ]),
  );

  // What every kind of row shares. Hovering or focusing anywhere in a row lights up its pin.
  const rowState = (
    kind: "event" | "rescue",
    item: { id: string; buildingId: string; room: string | null },
  ): RowState => {
    const point = () => onHover({ kind, buildingId: item.buildingId, id: item.id, source: "list" });
    const leave = () => onHover(null);
    return {
      place: placeLabel(buildingById.get(item.buildingId), item.room),
      selected: selectedId === item.id,
      pointed: isHovered(hover, kind, item.buildingId, item.id),
      fresh: freshIds.has(item.id),
      delay: settled ? 0 : Math.min(order.get(item.id) ?? 0, STAGGER_ROWS) * STAGGER_MS,
      now,
      hoverProps: { onMouseEnter: point, onMouseLeave: leave, onFocus: point, onBlur: leave },
      onSelect: () => onSelect({ kind, id: item.id }),
    };
  };

  return (
    <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {rescues.length > 0 && (
        <section aria-label="Free food right now">
          <SectionHeading count={rescues.length}>Free food right now</SectionHeading>
          <ul className="divide-y">
            {rescues.map((rescue) => (
              <RescueRow key={rescue.id} rescue={rescue} {...rowState("rescue", rescue)} />
            ))}
          </ul>
        </section>
      )}

      {sections.map((section) => (
        <section key={section.label} aria-label={section.label}>
          <SectionHeading live={section.label === LIVE_LABEL} count={section.events.length}>
            {section.label}
          </SectionHeading>
          <ul className="divide-y">
            {section.events.map((event) => {
              const Row = event.id === featuredId ? FeaturedRow : EventRow;
              return <Row key={event.id} event={event} {...rowState("event", event)} />;
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
