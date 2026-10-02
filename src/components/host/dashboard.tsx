"use client";

// Mobbin reference: Calendly, event types (one list split into named owner groups, actions on each row).
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, TriangleAlert, User, Users } from "lucide-react";
import { useUser } from "@/components/auth-provider";
import { useNow } from "@/components/food/countdown";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listBuildings, listMyClubs, listMyHostedEvents, subscribeToCampus } from "@/lib/db";
import type { Building, CampusEvent, MyClub } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DashboardRow } from "./dashboard-row";
import { type EventPhase, eventPhase, turnoutRate } from "./host-utils";

const numberFormat = new Intl.NumberFormat();
const TILES = "grid gap-3 sm:grid-cols-3";
const TILE = "rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10";
const PULSE = "motion-reduce:animate-none";

// Timeline: the date sits in a narrow left column, the cards hang off a dashed line.
const DAY = "sm:flex";
const DAY_LABEL = "mb-2 flex min-w-0 items-baseline gap-2 sm:mb-0 sm:w-28 sm:shrink-0 sm:flex-col sm:gap-0 sm:pr-4";
const DAY_BODY =
  "relative min-w-0 flex-1 pb-6 group-last/day:pb-0 sm:border-l sm:border-dashed sm:border-foreground/20 sm:pl-6";
const DAY_DOT =
  "absolute top-2 -left-[4.5px] hidden size-2 rounded-full bg-muted-foreground ring-4 ring-background sm:block";

type Tab = "upcoming" | "past";
type DayGroup = { key: string; label: string; weekday: string; items: CampusEvent[] };

const monthDayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const RELATIVE_DAYS: Record<number, string> = { [-1]: "Yesterday", 0: "Today", 1: "Tomorrow" };

function startOfDay(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Groups by the local calendar day an event starts on, keeping the list order.
function groupByDay(list: CampusEvent[], now: number): DayGroup[] {
  const today = startOfDay(now);
  const groups = new Map<string, DayGroup>();
  for (const event of list) {
    const startsAt = Date.parse(event.startsAt);
    const day = Number.isNaN(startsAt) ? null : startOfDay(startsAt);
    const key = day === null ? "unknown" : String(day);
    let group = groups.get(key);
    if (!group) {
      // Rounding absorbs the 23 and 25 hour days around a clock change.
      const offset = day === null ? null : Math.round((day - today) / 86_400_000);
      group = {
        key,
        label:
          day === null || offset === null
            ? "Date not set"
            : (RELATIVE_DAYS[offset] ?? monthDayFormat.format(day)),
        weekday: day === null ? "" : weekdayFormat.format(day),
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(event);
  }
  return [...groups.values()];
}

// One club the host organizes, or "Just me" (club is null) for everything else.
type ClubGroup = { key: string; label: string; club: MyClub | null; items: CampusEvent[] };

// Clubs first in name order, then "Just me". Groups with nothing to show are left out.
function groupByClub(list: CampusEvent[], clubs: MyClub[]): ClubGroup[] {
  const mine = new Set(clubs.map((club) => club.id));
  const groups: ClubGroup[] = clubs.map((club) => ({
    key: club.id,
    label: club.name,
    club,
    items: list.filter((event) => event.clubId === club.id),
  }));
  groups.push({
    key: "solo",
    label: "Just me",
    club: null,
    items: list.filter((event) => !event.clubId || !mine.has(event.clubId)),
  });
  return groups.filter((group) => group.items.length > 0);
}

type State = { events: CampusEvent[] | null; clubs: MyClub[]; error: string | null };

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
  const [state, setState] = useState<State>({ events: null, clubs: [], error: null });
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [retrying, setRetrying] = useState(false);
  // Null until the host picks a tab, so the default can follow the data.
  const [tabChoice, setTabChoice] = useState<Tab | null>(null);

  const fetchEvents = useCallback(async (): Promise<State | null> => {
    // Before anonymous sign-in finishes the list would come back empty.
    if (!userId) return null;
    try {
      // Club names are a nicety: without them every event lands under "Just me".
      const [events, clubs] = await Promise.all([
        listMyHostedEvents(),
        listMyClubs().catch((): MyClub[] => []),
      ]);
      clubs.sort((a, b) => a.name.localeCompare(b.name));
      return { events, clubs, error: null };
    } catch (error) {
      return {
        events: null,
        clubs: [],
        error: error instanceof Error ? error.message : "Check your connection.",
      };
    }
  }, [userId]);

  // A failed refresh keeps the last good list on screen.
  const apply = useCallback((next: State) => {
    setState((current) => (next.events ? next : { ...current, error: next.error }));
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

  const { events, clubs, error } = state;

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
        <div className="flex justify-end">
          <Skeleton className={cn("h-10 w-44 rounded-lg", PULSE)} />
        </div>
        <div>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={cn("group/day", DAY)}>
              <div className={DAY_LABEL}>
                <Skeleton className={cn("h-5 w-16", PULSE)} />
                <Skeleton className={cn("h-4 w-20 sm:mt-1.5", PULSE)} />
              </div>
              <div className={DAY_BODY}>
                <span className={DAY_DOT} />
                <div className={cn(TILE, "flex items-start gap-4")}>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <Skeleton className={cn("h-4 w-32", PULSE)} />
                    <Skeleton className={cn("h-6 w-2/3", PULSE)} />
                    <Skeleton className={cn("h-4 w-1/2", PULSE)} />
                    <Skeleton className={cn("h-9 w-full max-w-56 rounded-lg", PULSE)} />
                  </div>
                  <Skeleton className={cn("size-18 shrink-0 rounded-lg sm:size-30", PULSE)} />
                </div>
              </div>
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

  const upcoming = [...byPhase.now, ...byPhase.upcoming];
  const tab: Tab = tabChoice ?? (upcoming.length === 0 && byPhase.past.length > 0 ? "past" : "upcoming");
  const visible = tab === "upcoming" ? upcoming : byPhase.past;
  const groups = groupByClub(visible, clubs);
  // A host with no clubs sees one plain list, with no "Just me" heading over it.
  const grouped = clubs.length > 0 || groups.some((group) => group.club);
  const liveIds = new Set(byPhase.now.map((event) => event.id));
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "upcoming", label: "Upcoming", count: upcoming.length },
    { id: "past", label: "Past", count: byPhase.past.length },
  ];

  return (
    <div className="space-y-6">
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

      <section aria-label="Events" className="space-y-4">
        <div className="flex justify-end">
          <div role="group" aria-label="Show events" className="flex rounded-lg bg-muted p-0.5">
            {tabs.map(({ id, label, count }) => (
              <button
                key={id}
                type="button"
                aria-pressed={tab === id}
                onClick={() => setTabChoice(id)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  tab === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {numberFormat.format(count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-pretty text-muted-foreground">
            {tab === "upcoming"
              ? "Nothing coming up. Past events are under Past."
              : "No past events yet. They show up here once they end."}
          </p>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => {
              const GroupIcon = group.club ? Users : User;
              const headingId = `host-group-${group.key}`;
              return (
                <section
                  key={group.key}
                  aria-labelledby={grouped ? headingId : undefined}
                  className="space-y-4"
                >
                  {grouped && (
                    <div className="flex min-w-0 items-center gap-2 border-b border-foreground/10 pb-2">
                      <GroupIcon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <h2
                        id={headingId}
                        className="min-w-0 truncate font-heading text-base font-semibold"
                      >
                        {group.label}
                      </h2>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {numberFormat.format(group.items.length)}
                      </span>
                      {group.club && (
                        <Link
                          href={`/clubs/${group.club.id}`}
                          aria-label={`Club page for ${group.club.name}`}
                          className={cn(
                            buttonVariants({ variant: "ghost" }),
                            "-my-1 ml-auto h-9 shrink-0 px-3 text-muted-foreground",
                          )}
                        >
                          Club page
                        </Link>
                      )}
                    </div>
                  )}
                  <ul>
                    {groupByDay(group.items, now).map((day) => (
                      <li key={day.key} className={cn("group/day", DAY)}>
                        <div className={DAY_LABEL}>
                          <h3 className="font-heading text-base font-medium">{day.label}</h3>
                          {day.weekday && (
                            <p className="text-sm text-muted-foreground">{day.weekday}</p>
                          )}
                        </div>
                        <div className={DAY_BODY}>
                          <span aria-hidden="true" className={DAY_DOT} />
                          <ul className="space-y-3">
                            {day.items.map((event) => (
                              <li key={event.id} className="min-w-0">
                                <DashboardRow
                                  event={event}
                                  building={buildingById.get(event.buildingId)}
                                  phase={
                                    tab === "past"
                                      ? "past"
                                      : liveIds.has(event.id)
                                        ? "now"
                                        : "upcoming"
                                  }
                                  // The heading names the club. Only an event of a club the
                                  // host is no longer in, filed under "Just me", needs a label.
                                  clubLabel={
                                    !group.club && event.clubId ? event.clubName : undefined
                                  }
                                  started={Date.parse(event.startsAt) <= now}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
