"use client";

import { useEffect, useId, useState } from "react";
import { Search, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listGuests } from "@/lib/db";
import type { Guest } from "@/lib/types";
import { formatClock } from "./host-utils";

type State = {
  guests: Guest[] | null; // null until the first reply
  error: string | null;
};

// Not yet first (the people the host is still waiting for), then checked in. Each by name.
function byDoorOrder(a: Guest, b: Guest): number {
  const aIn = a.checkedInAt ? 1 : 0;
  const bIn = b.checkedInAt ? 1 : 0;
  if (aIn !== bIn) return aIn - bIn;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function GuestRow({ guest }: { guest: Guest }) {
  const name = guest.name.trim() || "Guest";
  const clock = guest.checkedInAt ? formatClock(guest.checkedInAt) : "";

  return (
    <li className="flex min-h-14 items-center gap-3 px-3 py-2">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground uppercase"
      >
        {Array.from(name)[0]}
      </span>
      <p className="min-w-0 flex-1 truncate text-base font-medium">{name}</p>
      {guest.checkedInAt ? (
        <Badge className="h-7 shrink-0 px-2.5 text-sm tabular-nums">{clock ? `Checked in ${clock}` : "Checked in"}</Badge>
      ) : (
        <Badge variant="outline" className="h-7 shrink-0 px-2.5 text-sm text-muted-foreground">
          Not yet
        </Badge>
      )}
    </li>
  );
}

// Read-only: a guest has no ticket code here, so the host checks people in by scan or typed code.
export function CheckInList({ eventId, version }: { eventId: string; version: number }) {
  const [state, setState] = useState<State>({ guests: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const searchId = useId();

  // Refetches on every live change. The cleanup flag drops replies that
  // arrive after a newer request or after unmount.
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

  if (!guests) {
    return (
      <section aria-label="Guest list" className="flex flex-col gap-3">
        {error ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border p-4">
            <p className="flex items-start gap-2 text-sm">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span className="min-w-0 text-pretty break-words">
                Could not load the guest list. {error}
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-12 touch-manipulation px-5 text-base"
              onClick={retry}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div aria-busy="true" className="flex flex-col gap-2">
            <p role="status" className="sr-only">
              Loading guests
            </p>
            <Skeleton className="h-12 w-full motion-reduce:animate-none" />
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full motion-reduce:animate-none" />
            ))}
          </div>
        )}
      </section>
    );
  }

  if (guests.length === 0) {
    return (
      <section aria-label="Guest list">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-10 text-center">
          <Users aria-hidden className="size-6 text-muted-foreground" />
          <p className="text-base font-medium">No one has registered yet</p>
          <p className="text-sm text-pretty text-muted-foreground">
            The list fills in as students register.
          </p>
        </div>
      </section>
    );
  }

  const needle = query.trim().toLowerCase();
  const visible = guests
    .filter((guest) => !needle || guest.name.toLowerCase().includes(needle))
    .sort(byDoorOrder);

  return (
    <section aria-label="Guest list" className="flex flex-col gap-3">
      {error && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="min-w-0 text-pretty break-words">
            Could not refresh, so this list may be out of date. {error}
          </span>
        </p>
      )}

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search guests by name
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={searchId}
          name="guest-search"
          type="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Search by name…"
          className="h-12 pl-10"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <p className="text-sm text-pretty text-muted-foreground">
        To check someone in without a phone, ask for the 8-character code on their ticket and type
        it below.
      </p>

      <p role="status" className="sr-only">
        {visible.length} of {guests.length} {guests.length === 1 ? "guest" : "guests"} shown
      </p>

      {visible.length > 0 ? (
        <ul className="divide-y rounded-2xl border">
          {visible.map((guest) => (
            <GuestRow key={guest.rsvpId} guest={guest} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm font-medium">
          No guests match that name
        </p>
      )}
    </section>
  );
}
