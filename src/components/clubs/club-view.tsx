"use client";

// Mobbin reference: Apple Music's artist concerts page (avatar and name on top,
// then rows that lead with a small date tile), with the header of the Sweatpals
// community page.

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, SearchX, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getClub, listBuildings, listClubEvents, listMyClubs } from "@/lib/db";
import type { Building, CampusEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  formatTime,
  formatTimeRange,
  isHappeningNow,
  placeLabel,
} from "@/components/map/map-utils";
import { useNow } from "@/components/map/use-event-filters";
import { ClubAvatar, LiveBadge } from "./club-avatar";
import { LevelBadge } from "./club-level";
import { ClubError, ClubMessage, useLoad } from "./club-states";
import {
  clubTotals,
  dayNumber,
  isClubId,
  monthLabel,
  pastDayLabel,
  splitEvents,
} from "./club-utils";

export function ClubView({ id }: { id: string }) {
  // The club, its events and the building names. The visitor's own level decides
  // whether the page says anything about running the club: a student who is not
  // in it sees no badge and no management link.
  const load = useCallback(async () => {
    if (!isClubId(id)) return null;
    const club = await getClub(id);
    if (!club) return null;
    const [events, buildings, mine] = await Promise.all([
      listClubEvents(id),
      listBuildings(),
      listMyClubs().catch(() => []),
    ]);
    const level = mine.find((entry) => entry.id === id)?.role ?? null;
    return { club, events, buildings, level };
  }, [id]);

  const { status, data, error, reload } = useLoad(load);
  const now = useNow();

  const buildingById = useMemo(
    () => new Map((data?.buildings ?? []).map((building) => [building.id, building])),
    [data],
  );

  if (status === "loading") return <LoadingView />;

  if (status === "error") {
    return (
      <>
        <BackLink />
        <ClubError title="Could not load this club" message={error} onRetry={reload} />
      </>
    );
  }

  if (!data) {
    return (
      <ClubMessage icon={SearchX} title="Club not found">
        <Link
          href="/clubs"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
        >
          All clubs
        </Link>
      </ClubMessage>
    );
  }

  const { club, events, level } = data;
  const { upcoming, past } = splitEvents(events, now);
  const totals = clubTotals(events, now);
  const live = upcoming.some((event) => isHappeningNow(event, now));

  return (
    <div className="animate-in duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] fade-in motion-reduce:animate-none">
      <BackLink />

      <header className="mt-4 flex items-center gap-4">
        <ClubAvatar club={club} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-balance break-words">
              {club.name}
            </h1>
            {level && <LevelBadge level={level} />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {live && <LiveBadge />}
            <span className="tabular-nums">
              {upcoming.length > 0 ? `${upcoming.length} upcoming` : "No upcoming events"}
            </span>
          </div>
        </div>
        {level && (
          <Link
            href="/host"
            className={cn(buttonVariants({ variant: "outline" }), "h-9 shrink-0 px-3")}
          >
            Dashboard
          </Link>
        )}
      </header>

      <dl className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Events held" value={totals.held} />
        <Stat label="Registered" value={totals.registered} />
        <Stat label="Checked in" value={totals.checkedIn} />
      </dl>

      <section aria-labelledby="club-upcoming" className="mt-8">
        <h2 id="club-upcoming" className="text-sm font-medium text-muted-foreground">
          Upcoming
        </h2>
        {upcoming.length > 0 ? (
          <EventRows events={upcoming} buildingById={buildingById} now={now} />
        ) : (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            <CalendarDays aria-hidden className="size-5 shrink-0" />
            Nothing planned yet
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="club-past" className="mt-8">
          <h2 id="club-past" className="text-sm font-medium text-muted-foreground">
            Past
          </h2>
          <EventRows events={past} buildingById={buildingById} now={now} past />
        </section>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/clubs"
      className="-ml-1 inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Clubs
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10 sm:px-4">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value.toLocaleString("en-US")}</dd>
    </div>
  );
}

function EventRows({
  events,
  buildingById,
  now,
  past,
}: {
  events: CampusEvent[];
  buildingById: Map<string, Building>;
  now: number;
  past?: boolean;
}) {
  return (
    <ul className="mt-3 divide-y rounded-xl bg-card ring-1 ring-foreground/10">
      {events.map((event) => (
        <li key={event.id} className="first:*:rounded-t-xl last:*:rounded-b-xl">
          <EventRow
            event={event}
            building={buildingById.get(event.buildingId)}
            now={now}
            past={past}
          />
        </li>
      ))}
    </ul>
  );
}

function EventRow({
  event,
  building,
  now,
  past,
}: {
  event: CampusEvent;
  building: Building | undefined;
  now: number;
  past?: boolean;
}) {
  const time = past
    ? `${pastDayLabel(event.startsAt)}, ${formatTime(event.startsAt)}`
    : formatTimeRange(event, now);
  // The public registration counter, the same number the event page shows.
  const going = `${event.rsvpCount.toLocaleString("en-US")} ${past ? "registered" : "going"}`;

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex items-start gap-3 p-3 transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset sm:gap-4 sm:p-4"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-12 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
          past ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
        )}
      >
        <span className="text-[0.65rem] font-medium uppercase">{monthLabel(event.startsAt)}</span>
        <span className="mt-0.5 text-lg font-semibold tabular-nums">
          {dayNumber(event.startsAt)}
        </span>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 font-medium break-words">{event.title}</h3>
          {!past && isHappeningNow(event, now) && <LiveBadge />}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{time}</p>
        <p className="text-sm break-words text-muted-foreground">
          {placeLabel(building, event.room)}
        </p>
        {event.hasFood && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge className="bg-accent text-accent-foreground">
              <Utensils aria-hidden /> Free food
            </Badge>
            {event.foodItems.map((item) => (
              <Badge
                key={item}
                variant="outline"
                className="border-accent/50 bg-accent/10 text-accent-foreground capitalize"
              >
                {item}
              </Badge>
            ))}
          </div>
        )}
        <p className="mt-2 text-sm font-medium tabular-nums sm:hidden">{going}</p>
      </div>

      <p className="hidden shrink-0 pt-0.5 text-sm font-medium tabular-nums sm:block">{going}</p>
    </Link>
  );
}

function LoadingView() {
  const pulse = "motion-reduce:animate-none";
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading club
      </p>
      <Skeleton className={cn("h-5 w-16", pulse)} />
      <div className="mt-4 flex items-center gap-4">
        <Skeleton className={cn("size-16 rounded-2xl", pulse)} />
        <div className="flex-1 space-y-2">
          <Skeleton className={cn("h-7 w-1/2", pulse)} />
          <Skeleton className={cn("h-4 w-24", pulse)} />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className={cn("h-[4.5rem] rounded-xl", pulse)} />
        ))}
      </div>
      <Skeleton className={cn("mt-8 h-4 w-20", pulse)} />
      <Skeleton className={cn("mt-3 h-56 w-full rounded-xl", pulse)} />
    </div>
  );
}
