"use client";

import Link from "next/link";
import { ArrowRight, CalendarX, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Building, CampusEvent } from "@/lib/types";
import { formatTimeRange, isHappeningNow, placeLabel } from "@/components/map/map-utils";
import { useNow } from "@/components/map/use-event-filters";

type EventStripProps = {
  buildings: Building[];
  events: CampusEvent[];
  loading: boolean;
  error: string | null;
};

const MAX_CARDS = 6;
const gridClass = "mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

function EventCard({
  event,
  building,
  now,
}: {
  event: CampusEvent;
  building: Building | undefined;
  now: number;
}) {
  const live = isHappeningNow(event, now);
  return (
    <li className="min-w-0">
      <Link
        href={`/events/${event.id}`}
        className="group block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Card className="h-full gap-3 px-4 transition-shadow group-hover:ring-primary/40">
          {(live || event.hasFood) && (
            <div className="flex flex-wrap gap-1.5">
              {live && <Badge>Happening now</Badge>}
              {event.hasFood && (
                <Badge className="bg-accent text-accent-foreground">Free food</Badge>
              )}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base leading-snug font-semibold break-words group-hover:text-primary">
              {event.title}
            </h3>
            <p className="mt-0.5 text-sm break-words text-muted-foreground">{event.clubName}</p>
          </div>
          <div className="mt-auto space-y-1 text-sm text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 tabular-nums">{formatTimeRange(event, now)}</span>
            </p>
            <p className="flex items-start gap-1.5">
              <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 break-words">{placeLabel(building, event.room)}</span>
            </p>
            {event.rsvpCount > 0 && (
              <p className="pt-1 font-medium text-foreground tabular-nums">
                {event.rsvpCount} going
              </p>
            )}
          </div>
        </Card>
      </Link>
    </li>
  );
}

export function EventStrip({ buildings, events, loading, error }: EventStripProps) {
  const now = useNow();
  const buildingById = new Map(buildings.map((building) => [building.id, building]));
  const next = events.slice(0, MAX_CARDS);

  return (
    <section aria-labelledby="happening-heading">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <h2
          id="happening-heading"
          className="text-2xl font-semibold tracking-tight text-balance lowercase sm:text-3xl"
        >
          Happening on campus
        </h2>

        {error ? (
          <p role="alert" className="mt-6 text-sm text-muted-foreground">
            Could not load events. The map may still work.
          </p>
        ) : loading ? (
          <div role="status" className={gridClass}>
            <span className="sr-only">Loading events…</span>
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index} aria-hidden className="gap-3 px-4">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-4 w-3/5" />
              </Card>
            ))}
          </div>
        ) : next.length === 0 ? (
          <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
            <CalendarX aria-hidden className="size-6 text-muted-foreground" />
            <p className="font-medium">Nothing posted yet</p>
            <p className="text-sm text-muted-foreground">
              Running something on campus? Put it on the map.
            </p>
            <Link href="/post" className={buttonVariants({ variant: "outline" })}>
              Post an event
            </Link>
          </div>
        ) : (
          <ul className={gridClass}>
            {next.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                building={buildingById.get(event.buildingId)}
                now={now}
              />
            ))}
          </ul>
        )}

        <Link
          href="/map"
          className={cn(
            "mt-8 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline",
            "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          )}
        >
          See everything on the map
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}
