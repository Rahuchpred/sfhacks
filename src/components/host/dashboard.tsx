"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, TriangleAlert } from "lucide-react";
import { useUser } from "@/components/auth-provider";
import { useNow } from "@/components/food/countdown";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listBuildings, listMyHostedEvents, subscribeToCampus } from "@/lib/db";
import type { Building, CampusEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DashboardRow } from "./dashboard-row";
import { type EventPhase, eventPhase, turnoutRate } from "./host-utils";

const numberFormat = new Intl.NumberFormat();
const TILES = "grid gap-3 sm:grid-cols-3";
const TILE = "rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10";
const PULSE = "motion-reduce:animate-none";

const SECTIONS: { phase: EventPhase; id: string; title: string }[] = [
  { phase: "now", id: "host-now", title: "Happening now" },
  { phase: "upcoming", id: "host-upcoming", title: "Upcoming" },
  { phase: "past", id: "host-past", title: "Past" },
];

type State = { events: CampusEvent[] | null; error: string | null };

function StatTile({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={TILE}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-heading tabular-nums",
          muted ? "text-base text-muted-foreground" : "text-3xl font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function Dashboard() {
  const user = useUser();
  const userId = user?.id ?? null;
  const now = useNow(30_000);
  const [state, setState] = useState<State>({ events: null, error: null });
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [retrying, setRetrying] = useState(false);

  const fetchEvents = useCallback(async (): Promise<State | null> => {
    // Before anonymous sign-in finishes the list would come back empty.
    if (!userId) return null;
    try {
      return { events: await listMyHostedEvents(), error: null };
    } catch (error) {
      return {
        events: null,
        error: error instanceof Error ? error.message : "Check your connection.",
      };
    }
  }, [userId]);

  // A failed refresh keeps the last good list on screen.
  const apply = useCallback((next: State) => {
    setState((current) => (next.events ? next : { events: current.events, error: next.error }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await fetchEvents();
      if (next && !cancelled) apply(next);
    };
    load();
    const unsubscribe = subscribeToCampus(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchEvents, apply]);

  useEffect(() => {
    let cancelled = false;
    // Place names are a nicety: without them rows fall back to "Campus".
    listBuildings()
      .then((list) => {
        if (!cancelled) setBuildings(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = async () => {
    setRetrying(true);
    const next = await fetchEvents();
    if (next) apply(next);
    setRetrying(false);
  };

  const buildingById = useMemo(
    () => new Map(buildings.map((building) => [building.id, building])),
    [buildings],
  );

  const { events, error } = state;

  if (!events && !error) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p role="status" className="sr-only">
          Loading your events…
        </p>
        <div className={TILES}>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={cn(TILE, "space-y-2")}>
              <Skeleton className={cn("h-4 w-24", PULSE)} />
              <Skeleton className={cn("h-9 w-16", PULSE)} />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={cn(TILE, "space-y-3")}>
              <Skeleton className={cn("h-5 w-2/3", PULSE)} />
              <Skeleton className={cn("h-4 w-1/2", PULSE)} />
              <Skeleton className={cn("h-10 w-full rounded-lg sm:w-72", PULSE)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!events) {
    return (
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center"
      >
        <TriangleAlert aria-hidden="true" className="size-6 text-destructive" />
        <p className="text-base font-medium">Could not load your events.</p>
        <p className="text-sm text-pretty break-words text-muted-foreground">{error}</p>
        <Button variant="outline" className="h-10 px-4" disabled={retrying} onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  const warning = error && (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      <span className="min-w-0 text-pretty break-words">
        Could not refresh, so these numbers may be out of date. {error}
      </span>
    </p>
  );

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        {warning}
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <CalendarPlus aria-hidden="true" className="size-6 text-primary" />
          </div>
          <p className="text-base font-medium text-balance">You have not posted an event yet</p>
          <p className="text-sm text-pretty text-muted-foreground">
            Post one and its guest list and check-in show up here.
          </p>
          <Link href="/post" className={cn(buttonVariants(), "h-10 px-4")}>
            Post an event
          </Link>
        </div>
      </div>
    );
  }

  const byPhase: Record<EventPhase, CampusEvent[]> = { now: [], upcoming: [], past: [] };
  for (const event of events) byPhase[eventPhase(event, now)].push(event);
  // The list arrives newest first, which already suits "Past".
  byPhase.upcoming.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  byPhase.now.sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));

  const checkIns = events.reduce((sum, event) => sum + event.checkedInCount, 0);
  // Events nobody registered for are left out of the average.
  const withRsvps = events.filter((event) => event.rsvpCount > 0);
  const turnout = turnoutRate(
    withRsvps.reduce((sum, event) => sum + event.checkedInCount, 0),
    withRsvps.reduce((sum, event) => sum + event.rsvpCount, 0),
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link href="/post" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
          <CalendarPlus aria-hidden="true" />
          Post an event
        </Link>
      </div>

      <dl className={TILES}>
        <StatTile label="Events hosted" value={numberFormat.format(events.length)} />
        <StatTile label="Total check-ins" value={numberFormat.format(checkIns)} />
        <StatTile
          label="Average turnout"
          value={turnout === null ? "No data yet" : `${numberFormat.format(turnout)}%`}
          muted={turnout === null}
        />
      </dl>

      {warning}

      {SECTIONS.map(({ phase, id, title }) => {
        const list = byPhase[phase];
        if (list.length === 0) return null;
        return (
          <section key={phase} aria-labelledby={id} className="space-y-3">
            <h2 id={id} className="font-heading text-lg font-medium">
              {title}{" "}
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {numberFormat.format(list.length)}
              </span>
            </h2>
            <ul className="space-y-3">
              {list.map((event) => (
                <li key={event.id} className="min-w-0">
                  <DashboardRow
                    event={event}
                    building={buildingById.get(event.buildingId)}
                    phase={phase}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
