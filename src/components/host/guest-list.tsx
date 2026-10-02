"use client";

// Mobbin reference (web): Sweatpals, event RSVPs table with a check-in column per attendee.

import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, Search, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { selectClass } from "@/components/post/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { checkInGuest, listGuests } from "@/lib/db";
import type { Guest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatClock, formatStamp } from "./host-utils";

type Filter = "all" | "in" | "out";
type Sort = "newest" | "name";

type State = {
  guests: Guest[] | null; // null until the first reply
  error: string | null;
};

const countFormat = new Intl.NumberFormat();

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const CONTROL = "h-10 w-auto max-w-full";
// A long guest list opens short. Searching looks through everyone.
const PREVIEW = 8;
const LIST = "divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10";

// "11 hours ago", "2 days ago". Anything under a minute reads "just now".
function formatRelative(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((then - now) / 60_000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return relativeFormat.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormat.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeFormat.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return relativeFormat.format(months, "month");
  return relativeFormat.format(Math.round(days / 365), "year");
}

function GuestRow({
  guest,
  now,
  pending,
  disabled,
  onCheckIn,
}: {
  guest: Guest;
  now: number;
  pending: boolean;
  disabled: boolean;
  onCheckIn: () => void;
}) {
  const name = guest.name.trim() || "Guest";
  const initial = name.charAt(0).toUpperCase();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
      <div className="flex min-w-0 basis-full items-center gap-2.5 sm:flex-1 sm:basis-0">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
        >
          {initial}
        </span>
        <p className="min-w-0 truncate text-sm font-medium">{name}</p>
        {guest.sfsuVerified && (
          <Badge variant="secondary" className="shrink-0">
            <BadgeCheck aria-hidden="true" className="text-primary" />
            Verified SFSU
          </Badge>
        )}
      </div>
      <div className="flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 pl-9.5 sm:flex-none sm:pl-0">
        <time
          dateTime={guest.createdAt}
          title={`Registered ${formatStamp(guest.createdAt)}`}
          className="text-xs whitespace-nowrap text-muted-foreground tabular-nums"
        >
          {formatRelative(guest.createdAt, now)}
        </time>
        {guest.checkedInAt ? (
          <Badge className="ml-auto tabular-nums">Checked in {formatClock(guest.checkedInAt)}</Badge>
        ) : (
          <Button
            size="lg"
            className="ml-auto h-9 min-w-26 px-3"
            disabled={disabled}
            aria-label={`Check in ${name}`}
            onClick={onCheckIn}
          >
            {pending && (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            )}
            Check in
          </Button>
        )}
      </div>
    </li>
  );
}

export function GuestList({
  eventId,
  version,
  now,
  onCheckedIn,
}: {
  eventId: string;
  version: number;
  now: number;
  onCheckedIn?: () => void; // lets the page refresh its counters right away
}) {
  const [state, setState] = useState<State>({ guests: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [showAll, setShowAll] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Check-ins made here, shown at once without waiting for the refetch.
  const [done, setDone] = useState<Record<string, string>>({});

  // Refetches when the event's live counters change. The cleanup flag drops
  // replies that arrive after a newer request or after unmount.
  useEffect(() => {
    let cancelled = false;
    listGuests(eventId)
      .then((guests) => {
        if (!cancelled) setState({ guests, error: null });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : "Check your connection.";
        setState((current) => ({ guests: current.guests, error: message }));
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, version, attempt]);

  // For a student with no ticket to show. The same call the door list makes.
  async function checkInRow(guest: Guest) {
    if (pendingId) return;
    const name = guest.name.trim() || "Guest";
    setPendingId(guest.rsvpId);
    try {
      const result = await checkInGuest(guest.rsvpId);
      if (result.ok || result.reason === "already_checked_in") {
        const at = result.checkedInAt ?? new Date().toISOString();
        setDone((current) => ({ ...current, [guest.rsvpId]: at }));
        if (result.ok) toast.success(`${name} checked in`);
        else toast.info(`${name} was already checked in`);
        onCheckedIn?.();
      } else {
        toast.error(
          result.reason === "not_host"
            ? "Only people in this event's club can check guests in."
            : "That registration no longer exists.",
        );
      }
    } catch {
      toast.error("Could not check in. Check your connection and try again.");
    } finally {
      setPendingId(null);
    }
  }

  const retry = () => {
    setState((current) => ({ guests: current.guests, error: null }));
    setAttempt((current) => current + 1);
  };

  const { guests, error } = state;

  const heading = (
    <h2 id="guests-heading" className="font-heading text-lg font-medium">
      Guests
    </h2>
  );

  if (!guests) {
    return (
      <section aria-labelledby="guests-heading" className="space-y-3">
        {heading}
        {error ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-4">
            <p className="flex items-start gap-2 text-sm">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span className="min-w-0 text-pretty break-words">
                Could not load the guest list. {error}
              </span>
            </p>
            <Button variant="outline" size="lg" className="h-10 px-4" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
          <div aria-busy="true">
            <p role="status" className="sr-only">
              Loading guests
            </p>
            <div className={LIST}>
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex items-center gap-2.5 px-3 py-2.5">
                  <Skeleton className="size-7 shrink-0 rounded-full motion-reduce:animate-none" />
                  <Skeleton className="h-4 w-32 motion-reduce:animate-none" />
                  <Skeleton className="ml-auto h-4 w-20 motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  if (guests.length === 0) {
    return (
      <section aria-labelledby="guests-heading" className="space-y-3">
        {heading}
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
          <Users aria-hidden="true" className="size-6 text-muted-foreground" />
          <p className="text-base font-medium">No one has registered yet</p>
          <p className="text-sm text-pretty text-muted-foreground">
            The list fills in as students register.
          </p>
        </div>
      </section>
    );
  }

  const rows = guests.map((guest) =>
    !guest.checkedInAt && done[guest.rsvpId] ? { ...guest, checkedInAt: done[guest.rsvpId] } : guest,
  );
  const checkedIn = rows.filter((guest) => guest.checkedInAt).length;
  const options: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All guests", count: guests.length },
    { value: "in", label: "Checked in", count: checkedIn },
    { value: "out", label: "Not yet", count: guests.length - checkedIn },
  ];

  const needle = query.trim().toLowerCase();
  const visible = rows
    .filter((guest) => {
      if (filter === "in" && !guest.checkedInAt) return false;
      if (filter === "out" && guest.checkedInAt) return false;
      return !needle || guest.name.toLowerCase().includes(needle);
    })
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );

  const shown = showAll ? visible : visible.slice(0, PREVIEW);

  return (
    <section aria-labelledby="guests-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {heading}
        <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
          Showing {countFormat.format(shown.length)} of {countFormat.format(guests.length)}{" "}
          {guests.length === 1 ? "guest" : "guests"}
        </p>
      </div>

      {error && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="min-w-0 text-pretty break-words">
            Could not refresh, so this list may be out of date. {error}
          </span>
        </p>
      )}

      <div className="relative">
        <label htmlFor="guest-search" className="sr-only">
          Search guests
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="guest-search"
          name="guest-search"
          type="search"
          autoComplete="off"
          placeholder="Search by name…"
          className="h-10 pl-8"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          name="guest-filter"
          aria-label="Filter guests"
          autoComplete="off"
          className={cn(selectClass, CONTROL, "tabular-nums")}
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({countFormat.format(option.count)})
            </option>
          ))}
        </select>
        <select
          name="guest-sort"
          aria-label="Sort guests"
          autoComplete="off"
          className={cn(selectClass, CONTROL)}
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
        >
          <option value="newest">Newest first</option>
          <option value="name">Name</option>
        </select>
      </div>

      {visible.length > 0 ? (
        <ul className={LIST}>
          {shown.map((guest) => (
            <GuestRow
              key={guest.rsvpId}
              guest={guest}
              now={now}
              pending={pendingId === guest.rsvpId}
              disabled={pendingId !== null}
              onCheckIn={() => checkInRow(guest)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm font-medium">
          No guests match
        </p>
      )}

      {visible.length > PREVIEW && (
        <Button
          variant="outline"
          className="h-10 w-full tabular-nums"
          aria-expanded={showAll}
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? "Show fewer" : `Show all ${countFormat.format(visible.length)}`}
        </Button>
      )}
    </section>
  );
}
