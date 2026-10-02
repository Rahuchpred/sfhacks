"use client";

// Mobbin reference: Customer.io's integrations directory (one search field over
// a grid of bordered cards, each a small logo tile, a name and one meta line).

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Search, SearchX, Users, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listClubs, listUpcomingEvents } from "@/lib/db";
import { cn } from "@/lib/utils";
import { countLabel, dayLabel, formatTime, isHappeningNow } from "@/components/map/map-utils";
import { useNow } from "@/components/map/use-event-filters";
import { ClubAvatar, LiveBadge } from "./club-avatar";
import { ClubError, ClubMessage, useLoad } from "./club-states";
import { matchesClub, summarizeClubs, type ClubSummary } from "./club-utils";

const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

// Two calls for the whole page: every club, and every upcoming event.
async function loadDirectory() {
  const [clubs, events] = await Promise.all([listClubs(), listUpcomingEvents()]);
  return { clubs, events };
}

export function ClubDirectory() {
  const { status, data, error, reload } = useLoad(loadDirectory);
  const now = useNow();
  const [query, setQueryValue] = useState("");
  // Cards animate in once, on load. Results that change while typing appear instantly.
  const [searched, setSearched] = useState(false);
  const setQuery = (value: string) => {
    setQueryValue(value);
    setSearched(true);
  };

  const summaries = useMemo(
    () => (data ? summarizeClubs(data.clubs, data.events, now) : []),
    [data, now],
  );
  const visible = summaries.filter((summary) => matchesClub(summary, query));

  if (status === "loading") {
    return (
      <div aria-busy="true" className="space-y-5">
        <p role="status" className="sr-only">
          Loading clubs
        </p>
        <Skeleton className="h-10 w-full max-w-sm motion-reduce:animate-none" />
        <div className={GRID}>
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return <ClubError title="Could not load clubs" message={error} onRetry={reload} />;
  }

  if (summaries.length === 0) {
    return (
      <ClubMessage icon={Users} title="No clubs yet">
        <Link
          href="/host/clubs"
          className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
        >
          Start a club
        </Link>
      </ClubMessage>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clubs"
            aria-label="Search clubs"
            autoComplete="off"
            className="h-10 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
          {countLabel(visible.length, "club")}
        </p>
      </div>

      {visible.length > 0 ? (
        <ul className={GRID}>
          {visible.map((summary, index) => (
            <li
              key={summary.club.id}
              // A short stagger on the first rows only, so a long list never waits.
              style={searched ? undefined : { animationDelay: `${Math.min(index, 8) * 30}ms` }}
              className={cn(
                "min-w-0",
                !searched &&
                  "animate-in fill-mode-backwards fade-in slide-in-from-bottom-1 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none",
              )}
            >
              <ClubCard summary={summary} now={now} />
            </li>
          ))}
        </ul>
      ) : (
        <ClubMessage icon={SearchX} title="No clubs match">
          <Button variant="outline" size="lg" className="h-10 px-4" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </ClubMessage>
      )}
    </div>
  );
}

function ClubCard({ summary, now }: { summary: ClubSummary; now: number }) {
  const { club, upcoming, next, live } = summary;
  return (
    <Link
      href={`/clubs/${club.id}`}
      className="group flex h-full flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-[box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:shadow-md hover:ring-primary/40 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <div className="flex items-center gap-3">
        <ClubAvatar club={club} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium" title={club.name}>
            {club.name}
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {upcoming > 0 ? `${upcoming} upcoming` : "No upcoming events"}
          </p>
        </div>
        {live && <LiveBadge />}
      </div>

      {next && (
        <div className="mt-auto flex items-start gap-2.5 border-t pt-3 text-sm">
          <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-medium">
              <span className="sr-only">Next event: </span>
              {next.title}
            </p>
            <p className="text-muted-foreground tabular-nums">
              {isHappeningNow(next, now)
                ? `Now, until ${formatTime(next.endsAt)}`
                : `${dayLabel(next.startsAt, now)}, ${formatTime(next.startsAt)}`}
            </p>
          </div>
        </div>
      )}
    </Link>
  );
}

function SkeletonCard() {
  const pulse = "motion-reduce:animate-none";
  return (
    <div className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-3">
        <Skeleton className={cn("size-11 rounded-xl", pulse)} />
        <div className="flex-1 space-y-2">
          <Skeleton className={cn("h-4 w-2/3", pulse)} />
          <Skeleton className={cn("h-3.5 w-1/3", pulse)} />
        </div>
      </div>
      <div className="space-y-2 border-t pt-3">
        <Skeleton className={cn("h-4 w-3/4", pulse)} />
        <Skeleton className={cn("h-3.5 w-1/2", pulse)} />
      </div>
    </div>
  );
}
