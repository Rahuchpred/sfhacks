"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, MapPin, Pencil, ScanLine, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useNow } from "@/components/food/countdown";
import { EventForm } from "@/components/post/event-form";
import { listBuildings } from "@/lib/db";
import type { Building, CampusEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CancelEvent } from "./cancel-event";
import { GuestList } from "./guest-list";
import { HostGate } from "./host-states";
import { eventPhase, formatEventTime, placeLabel, turnoutRate, type EventPhase } from "./host-utils";
import { Recap } from "./recap";
import { useHostEvent } from "./use-host-event";

const ACTION = "h-10 px-4";
const countFormat = new Intl.NumberFormat();

const PHASE: Record<EventPhase, { label: string; variant: "default" | "outline" | "secondary" }> = {
  upcoming: { label: "Upcoming", variant: "outline" },
  now: { label: "Happening now", variant: "default" },
  past: { label: "Ended", variant: "secondary" },
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse gap-1 rounded-xl border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-3xl font-semibold tabular-nums">{countFormat.format(value)}</dd>
    </div>
  );
}

function leftoverFoodHref(event: CampusEvent): string {
  const query = new URLSearchParams({ tab: "food", event: event.id, building: event.buildingId });
  if (event.room) query.set("room", event.room);
  return `/post?${query}`;
}

function ManageEvent({
  event,
  version,
  refresh,
}: {
  event: CampusEvent;
  version: number;
  refresh: () => Promise<void>;
}) {
  const now = useNow(30_000);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBuildings()
      .then((list) => {
        if (!cancelled) setBuildings(list);
      })
      .catch(() => {
        // The page still works without building names; the place reads "Campus".
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const phase = eventPhase(event, now);
  const place = placeLabel(
    buildings.find((building) => building.id === event.buildingId),
    event.room,
  );
  const rate = turnoutRate(event.checkedInCount, event.rsvpCount);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/host"
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Your events
        </Link>
        <h1 className="font-heading text-2xl font-semibold text-balance break-words sm:text-3xl">
          {event.title}
        </h1>
        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 tabular-nums">{formatEventTime(event)}</span>
          </p>
          <p className="flex items-start gap-2">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">{place}</span>
          </p>
        </div>
        <Badge variant={PHASE[phase].variant}>{PHASE[phase].label}</Badge>
      </header>

      {editing ? (
        <EventForm
          buildings={buildings}
          initial={event}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div aria-live="polite" className="flex flex-col gap-2">
            <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
              <Stat label="Going" value={event.rsvpCount} />
              <Stat label="Checked in" value={event.checkedInCount} />
            </dl>
            <p className="text-sm text-muted-foreground tabular-nums">
              {rate === null
                ? "Turnout shows once someone registers."
                : `${countFormat.format(rate)}% turnout`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/host/${event.id}/check-in`}
              className={cn(buttonVariants({ size: "lg" }), ACTION)}
            >
              <ScanLine aria-hidden="true" />
              Check in guests
            </Link>
            <Link
              href={`/events/${event.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), ACTION)}
            >
              View page
            </Link>
            <Button
              variant="outline"
              size="lg"
              className={ACTION}
              disabled={buildings.length === 0}
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Button>
            <CancelEvent event={event} />
            {phase === "past" && event.hasFood && (
              <Link
                href={leftoverFoodHref(event)}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  ACTION,
                  "bg-accent text-accent-foreground hover:bg-accent/85",
                )}
              >
                <Utensils aria-hidden="true" />
                Post leftover food
              </Link>
            )}
          </div>

          {phase === "past" && <Recap event={event} place={place} />}

          <GuestList eventId={event.id} version={version} />
        </>
      )}
    </div>
  );
}

export function Manage({ id }: { id: string }) {
  const { status, event, error, version, refresh } = useHostEvent(id);

  return (
    <HostGate status={status} error={error}>
      {event && <ManageEvent event={event} version={version} refresh={refresh} />}
    </HostGate>
  );
}
