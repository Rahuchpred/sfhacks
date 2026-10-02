"use client";

// Mobbin reference (web): Sweatpals, event page with the title bar, actions and RSVP list.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  ChartColumn,
  MapPin,
  Pencil,
  ScanLine,
  Utensils,
} from "lucide-react";
import { useUser } from "@/components/auth-provider";
import { LevelBadge } from "@/components/clubs/club-level";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { useNow } from "@/components/food/countdown";
import { EventForm } from "@/components/post/event-form";
import { listBuildings, listMyClubs } from "@/lib/db";
import { canOrganize, eventLevel } from "@/lib/roles";
import type { Building, CampusEvent, ClubLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CancelEvent } from "./cancel-event";
import { GuestList } from "./guest-list";
import { HostGate } from "./host-states";
import { eventPhase, formatEventTime, placeLabel, turnoutRate, type EventPhase } from "./host-utils";
import { useHostEvent } from "./use-host-event";
import { AnnounceButton } from "@/components/messages/announce-button";

const countFormat = new Intl.NumberFormat();

const TILE =
  "flex min-h-12 w-full items-center gap-3 rounded-xl bg-card p-3 text-left text-sm font-medium ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";
const TILE_ICON = "flex size-9 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4";

const PHASE: Record<EventPhase, { label: string; variant: "default" | "outline" | "secondary" }> = {
  upcoming: { label: "Upcoming", variant: "outline" },
  now: { label: "Happening now", variant: "default" },
  past: { label: "Ended", variant: "secondary" },
};

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const dollarsAndCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// "$120" or "$120.50": cents only when there are any.
function formatCost(cost: number): string {
  return (Number.isInteger(cost) ? dollars : dollarsAndCents).format(cost);
}

// "chips and snacks" reads "Chips and snacks" on a chip.
function chipLabel(item: string): string {
  return item.charAt(0).toUpperCase() + item.slice(1);
}

const DETAIL = "flex min-w-0 flex-col gap-1.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10";
const DETAIL_LABEL = "text-xs font-medium text-muted-foreground";

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
  // False until the building list has answered, so the place never reads "Campus" first.
  const [placeReady, setPlaceReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const userId = useUser()?.id ?? null;
  // The level over this event. Null until known: the organizer tools wait for it.
  const [level, setLevel] = useState<ClubLevel | null>(event.clubId ? null : "owner");

  useEffect(() => {
    if (!event.clubId || !userId) return;
    let cancelled = false;
    listMyClubs()
      .then((clubs) => {
        if (!cancelled) setLevel(eventLevel(event, clubs) ?? "member");
      })
      // Without an answer, show the member view. The database decides either way.
      .catch(() => {
        if (!cancelled) setLevel("member");
      });
    return () => {
      cancelled = true;
    };
    // The club of an event does not change while this page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.clubId, userId]);

  const canManage = canOrganize(level);

  // The form and the page it replaces have different heights, so each switch starts at the top.
  function showEditor(next: boolean) {
    setEditing(next);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  }

  useEffect(() => {
    let cancelled = false;
    listBuildings()
      .then((list) => {
        if (!cancelled) setBuildings(list);
      })
      .catch(() => {
        // The page still works without building names; the place reads "Campus".
      })
      .finally(() => {
        if (!cancelled) setPlaceReady(true);
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
  const going = Math.max(0, event.rsvpCount);
  const checkedIn = Math.min(going, Math.max(0, event.checkedInCount));
  const notYet = going - checkedIn;
  const share = going > 0 ? (checkedIn / going) * 100 : 0;
  // Leftovers can be posted once the event has started, and only for an event with food.
  const showLeftover = phase !== "upcoming" && event.hasFood;

  return (
    <div ref={topRef} className="flex scroll-mt-24 flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/host"
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Your events
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h1 className="min-w-0 font-heading text-2xl font-semibold text-balance break-words sm:text-3xl">
            {event.title}
          </h1>
          <Link
            href={`/events/${event.id}`}
            className={cn(buttonVariants({ variant: "outline" }), "w-fit sm:mt-1")}
          >
            Event page
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <p className="flex min-w-0 items-start gap-1.5">
            <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 tabular-nums">{formatEventTime(event)}</span>
          </p>
          <p className="flex min-w-0 items-start gap-1.5">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {placeReady ? (
              <span className="min-w-0 break-words">{place}</span>
            ) : (
              <span
                aria-hidden="true"
                className="h-5 w-40 animate-pulse rounded-md bg-muted motion-reduce:animate-none"
              />
            )}
          </p>
          <Badge variant={PHASE[phase].variant}>{PHASE[phase].label}</Badge>
          {event.clubId && level && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate">{event.clubName}</span>
              <LevelBadge level={level} />
            </span>
          )}
        </div>
      </header>

      {editing && canManage ? (
        <EventForm
          buildings={buildings}
          initial={event}
          onSaved={() => {
            showEditor(false);
            refresh();
          }}
          onCancel={() => showEditor(false)}
        />
      ) : (
        <>
          <section aria-labelledby="glance-heading" className="flex flex-col gap-3">
            <h2 id="glance-heading" className="font-heading text-lg font-medium">
              At a glance
            </h2>
            <div aria-live="polite" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-xl font-medium tabular-nums">
                  <span className="text-primary">{countFormat.format(going)}</span> going
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {rate === null
                    ? "Turnout shows once someone registers."
                    : `${countFormat.format(rate)}% turnout`}
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="Guests checked in"
                aria-valuemin={0}
                aria-valuemax={going}
                aria-valuenow={checkedIn}
                aria-valuetext={`${countFormat.format(checkedIn)} of ${countFormat.format(going)} checked in`}
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${share}%` }}
                />
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                  {countFormat.format(checkedIn)} checked in
                </li>
                <li className="flex items-center gap-1.5 text-muted-foreground">
                  <span aria-hidden="true" className="size-2 rounded-full bg-muted-foreground/40" />
                  {countFormat.format(notYet)} not yet
                </li>
              </ul>
            </div>
          </section>

          {canManage && <AnnounceButton eventId={event.id} />}

          <div className={cn("grid gap-3", canManage && "sm:grid-cols-3")}>
            <Link href={`/host/${event.id}/check-in`} className={TILE}>
              <span className={cn(TILE_ICON, "bg-primary/10 text-primary")}>
                <ScanLine aria-hidden="true" />
              </span>
              Check in guests
            </Link>
            {canManage && (
              <button
                type="button"
                className={TILE}
                disabled={buildings.length === 0}
                onClick={() => showEditor(true)}
              >
                <span className={cn(TILE_ICON, "bg-primary/10 text-primary")}>
                  <Pencil aria-hidden="true" />
                </span>
                Edit event
              </button>
            )}
            {canManage && (
              <Link href="/host/analytics" className={TILE}>
                <span className={cn(TILE_ICON, "bg-primary/10 text-primary")}>
                  <ChartColumn aria-hidden="true" />
                </span>
                Analytics
              </Link>
            )}
          </div>

          {showLeftover && (
            <Link
              href={`/host/${event.id}/food`}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 w-full bg-accent px-5 text-base text-accent-foreground hover:bg-accent/85 sm:w-fit",
              )}
            >
              <Utensils aria-hidden="true" />
              Post leftover food
            </Link>
          )}

          <section aria-labelledby="details-heading" className="flex flex-col gap-3">
            <h2 id="details-heading" className="font-heading text-lg font-medium">
              Details
            </h2>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className={DETAIL}>
                <dt className={DETAIL_LABEL}>Cost</dt>
                <dd
                  className={cn(
                    "text-xl font-medium tabular-nums",
                    event.cost === null && "text-muted-foreground",
                  )}
                >
                  {event.cost === null ? "Not set" : formatCost(event.cost)}
                </dd>
              </div>
              <div className={cn(DETAIL, "sm:col-span-2")}>
                <dt className={DETAIL_LABEL}>Food</dt>
                <dd className="flex min-h-7 flex-wrap items-center gap-1.5">
                  {!event.hasFood ? (
                    <span className="text-xl font-medium text-muted-foreground">None</span>
                  ) : event.foodItems.length === 0 ? (
                    <Badge className="h-7 bg-accent px-2.5 text-sm text-accent-foreground">
                      Free food
                    </Badge>
                  ) : (
                    event.foodItems.map((item) => (
                      <Badge
                        key={item}
                        className="h-7 bg-accent px-2.5 text-sm text-accent-foreground"
                      >
                        {chipLabel(item)}
                      </Badge>
                    ))
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <hr className="border-border" />

          <GuestList eventId={event.id} version={version} now={now} onCheckedIn={refresh} />

          {canManage && (
            <>
              <hr className="border-border" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-sm text-pretty text-muted-foreground">
                  Canceling removes the event from the map and all tickets.
                </p>
                <CancelEvent event={event} />
              </div>
            </>
          )}
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
