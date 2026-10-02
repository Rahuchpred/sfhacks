"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime, isHappeningNow, placeLabel } from "@/components/map/map-utils";
import { useNow } from "@/components/map/use-event-filters";
import type { Building, CampusEvent } from "@/lib/types";

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short" });

type HeroPreviewProps = {
  buildings: Building[];
  events: CampusEvent[];
  loading: boolean;
};

// The product itself in the hero: the next real events, each one click from its ticket.
export function HeroPreview({ buildings, events, loading }: HeroPreviewProps) {
  const now = useNow();
  const next = events.slice(0, 3);
  if (!loading && next.length === 0) return null;

  const buildingById = new Map(buildings.map((building) => [building.id, building]));

  return (
    <div className="overflow-hidden rounded-2xl border bg-background shadow-xl shadow-primary/10">
      <p className="flex items-center gap-2 border-b bg-muted px-5 py-2.5 text-xs font-medium text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-accent" />
        Next on campus
      </p>

      <ul className="divide-y">
        {loading
          ? Array.from({ length: 3 }, (_, index) => (
              <li key={index} aria-hidden className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="size-11 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              </li>
            ))
          : next.map((event) => {
              const starts = new Date(event.startsAt);
              const live = isHappeningNow(event, now);
              return (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <span
                      aria-hidden
                      className="flex size-11 shrink-0 flex-col overflow-hidden rounded-lg border bg-background text-center"
                    >
                      <span className="bg-primary text-[0.625rem] leading-4 font-semibold text-primary-foreground uppercase">
                        {monthFormat.format(starts)}
                      </span>
                      <span className="flex-1 text-base leading-7 font-semibold tabular-nums">
                        {starts.getDate()}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold">{event.title}</span>
                        {event.hasFood && (
                          <Badge className="bg-accent text-accent-foreground">Free food</Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground tabular-nums">
                        {live ? `Now, until ${formatTime(event.endsAt)}` : formatTime(event.startsAt)}
                        {", "}
                        {placeLabel(buildingById.get(event.buildingId), event.room)}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </Link>
                </li>
              );
            })}
      </ul>

      <p className="border-t px-5 py-3 text-xs text-muted-foreground">
        Register, get a QR ticket, check in at the door.
      </p>
    </div>
  );
}
