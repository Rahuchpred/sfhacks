"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listGuests } from "@/lib/db";
import type { Guest } from "@/lib/types";
import { formatClock, formatStamp } from "./host-utils";

type Filter = "all" | "in" | "out";

type State = {
  guests: Guest[] | null; // null until the first reply
  error: string | null;
};

const countFormat = new Intl.NumberFormat();

function GuestRow({ guest }: { guest: Guest }) {
  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-sm font-medium">{guest.name}</p>
          {guest.sfsuVerified && <Badge variant="secondary">Verified SFSU</Badge>}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          Registered {formatStamp(guest.createdAt)}
        </p>
      </div>
      {guest.checkedInAt ? (
        <Badge className="tabular-nums">Checked in {formatClock(guest.checkedInAt)}</Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          Not yet
        </Badge>
      )}
    </li>
  );
}

export function GuestList({ eventId, version }: { eventId: string; version: number }) {
  const [state, setState] = useState<State>({ guests: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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
          <div aria-busy="true" className="space-y-2">
            <p role="status" className="sr-only">
              Loading guests
            </p>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full motion-reduce:animate-none" />
            ))}
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

  const checkedIn = guests.filter((guest) => guest.checkedInAt).length;
  const options: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: guests.length },
    { value: "in", label: "Checked in", count: checkedIn },
    { value: "out", label: "Not yet", count: guests.length - checkedIn },
  ];

  const needle = query.trim().toLowerCase();
  const visible = guests.filter((guest) => {
    if (filter === "in" && !guest.checkedInAt) return false;
    if (filter === "out" && guest.checkedInAt) return false;
    return !needle || guest.name.toLowerCase().includes(needle);
  });

  return (
    <section aria-labelledby="guests-heading" className="space-y-3">
      {heading}

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5 sm:w-64">
          <label htmlFor="guest-search" className="text-sm font-medium">
            Search guests
          </label>
          <Input
            id="guest-search"
            name="guest-search"
            type="search"
            autoComplete="off"
            placeholder="Search by name…"
            className="h-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div role="group" aria-label="Filter guests" className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? "default" : "outline"}
              size="lg"
              className="h-10 px-3 tabular-nums"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label} ({countFormat.format(option.count)})
            </Button>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
        Showing {countFormat.format(visible.length)} of {countFormat.format(guests.length)}{" "}
        {guests.length === 1 ? "guest" : "guests"}
      </p>

      {visible.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {visible.map((guest) => (
            <GuestRow key={guest.rsvpId} guest={guest} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm font-medium">
          No guests match
        </p>
      )}
    </section>
  );
}
