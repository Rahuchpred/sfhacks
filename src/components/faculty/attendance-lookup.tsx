"use client";

// Layout after the reports page (Square "Timecards" on Mobbin): a list to pick from on the
// left, one plain table on the right, export in the table's header row.

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Check, Copy, Download, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime } from "@/components/map/map-utils";
import { TIMEZONE } from "@/lib/checks";
import { listBuildings } from "@/lib/db";
import { listEventAttendees, listStartedEvents, type Attendee } from "@/lib/db-faculty";
import { toCsv, toTsv, type Table } from "@/lib/reports";
import type { Building, CampusEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const isoDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE });

// Letters and digits only, lower case, so "Nguyen, Mei" and "mei nguyen" can be compared.
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9 ,]/g, "")
    .trim();
}

// A class list line matches an attendee when every word of the line is in the name.
function matches(line: string, attendee: string): boolean {
  const words = nameKey(line).split(/[ ,]+/).filter(Boolean);
  if (words.length === 0) return false;
  const have = new Set(nameKey(attendee).split(/[ ,]+/));
  return words.every((word) => have.has(word));
}

export function AttendanceLookup() {
  const userId = useUser()?.id;
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [attendeesError, setAttendeesError] = useState(false);
  const [roster, setRoster] = useState("");
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([listStartedEvents(), listBuildings()])
      .then(([started, allBuildings]) => {
        if (cancelled) return;
        setEvents(started);
        setBuildings(allBuildings);
        setSelectedId((current) => current ?? started[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the events. Reload the page to try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    listEventAttendees(selectedId)
      .then((list) => {
        if (cancelled) return;
        setAttendees(list);
        setAttendeesError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAttendees([]);
        setAttendeesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  function select(id: string) {
    if (id === selectedId) return;
    setAttendees(null);
    setSelectedId(id);
  }

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter(
      (event) =>
        event.title.toLowerCase().includes(needle) || event.clubName.toLowerCase().includes(needle),
    );
  }, [events, query]);

  const selected = events.find((event) => event.id === selectedId) ?? null;
  const place = selected
    ? [buildings.find((building) => building.id === selected.buildingId)?.name, selected.room]
        .filter(Boolean)
        .join(", ")
    : "";

  // The class list, one student per line, compared with the door check-ins.
  const lines = useMemo(
    () => roster.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    [roster],
  );
  const matched = useMemo(() => {
    if (!attendees || lines.length === 0) return null;
    const came = new Set<string>();
    const lineCame = lines.map((line) => {
      const hit = attendees.find((attendee) => matches(line, attendee.name));
      if (hit) came.add(hit.id);
      return { line, hit };
    });
    return { came, lineCame, count: lineCame.filter((item) => item.hit).length };
  }, [attendees, lines]);

  const rows = useMemo(() => {
    if (!attendees) return [];
    return matched ? attendees.filter((attendee) => matched.came.has(attendee.id)) : attendees;
  }, [attendees, matched]);

  function table(): Table {
    const event = selected?.title ?? "";
    const date = selected ? isoDayFormat.format(new Date(selected.startsAt)) : "";
    if (matched) {
      return {
        name: "Class list",
        header: ["Student", "Attended", "Event", "Date", "Checked in at"],
        rows: matched.lineCame.map(({ line, hit }) => [
          line,
          hit ? "yes" : "no",
          event,
          date,
          hit ? formatTime(hit.checkedInAt) : "",
        ]),
      };
    }
    return {
      name: "Attendance",
      header: ["Student", "Major", "Graduation year", "Verified SFSU", "Event", "Date", "Checked in at"],
      rows: rows.map((attendee) => [
        attendee.name,
        attendee.major,
        attendee.gradYear,
        attendee.sfsuVerified ? "yes" : "no",
        event,
        date,
        formatTime(attendee.checkedInAt),
      ]),
    };
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(toTsv(table()));
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
      toast.success("Copied. Paste it into a sheet.");
    } catch {
      toast.error("Could not copy. Use Download CSV instead.");
    }
  }

  function download() {
    const blob = new Blob(["﻿", toCsv(table())], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${(selected?.title ?? "event").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <p role="alert" className="mx-auto max-w-5xl px-4 py-10 text-sm font-medium text-destructive sm:px-6">
        {error}
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">Event attendance</h1>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <section aria-label="Events" className="flex min-w-0 flex-col gap-3">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search events"
              placeholder="Search events or clubs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 pl-9"
            />
          </div>
          {loading ? (
            <div className="flex flex-col gap-2" role="status" aria-label="Loading events">
              {[0, 1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No events found
            </p>
          ) : (
            <ul className="flex max-h-[32rem] flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1 lg:max-h-[calc(100dvh-14rem)]">
              {shown.map((event) => {
                const active = event.id === selectedId;
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => select(event.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                        active ? "border-primary bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{event.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {dayFormat.format(new Date(event.startsAt))}
                          {event.clubName && `, ${event.clubName}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums">
                          {event.checkedInCount}
                        </span>
                        <span className="block text-[0.6875rem] text-muted-foreground">came</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Attendance" aria-live="polite" className="flex min-w-0 flex-col gap-5">
          {!selected ? (
            !loading && (
              <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                Pick an event
              </p>
            )
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight text-balance">{selected.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {dayFormat.format(new Date(selected.startsAt))}, {formatTime(selected.startsAt)}
                    {place && `, ${place}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={copy} disabled={!attendees || attendees.length === 0}>
                    {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                    {copied ? "Copied" : "Copy for Sheets"}
                  </Button>
                  <Button variant="outline" onClick={download} disabled={!attendees || attendees.length === 0}>
                    <Download aria-hidden />
                    CSV
                  </Button>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-4 rounded-xl border p-4">
                <div>
                  <dd className="text-2xl font-semibold tabular-nums">{selected.rsvpCount}</dd>
                  <dt className="text-xs text-muted-foreground">Registered</dt>
                </div>
                <div>
                  <dd className="text-2xl font-semibold tabular-nums">{selected.checkedInCount}</dd>
                  <dt className="text-xs text-muted-foreground">Checked in</dt>
                </div>
                <div>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {matched ? `${matched.count} of ${lines.length}` : "n/a"}
                  </dd>
                  <dt className="text-xs text-muted-foreground">From your class</dt>
                </div>
              </dl>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="class-list" className="text-sm font-medium">
                  Your class list
                  <span className="ml-1.5 font-normal text-muted-foreground">Optional</span>
                </label>
                <textarea
                  id="class-list"
                  rows={3}
                  value={roster}
                  onChange={(event) => setRoster(event.target.value)}
                  placeholder="Paste names, one per line, to see who from your class came"
                  className="field-sizing-content max-h-40 min-h-20 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
              </div>

              {attendees === null ? (
                <div className="flex flex-col gap-2" role="status" aria-label="Loading attendance">
                  {[0, 1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-10 rounded-md" />
                  ))}
                </div>
              ) : attendeesError ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  Could not load the attendance. Pick the event again.
                </p>
              ) : matched ? (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Attended</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Checked in</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {matched.lineCame.map(({ line, hit }, index) => (
                        <tr key={`${line}-${index}`}>
                          <td className="px-3 py-2.5 font-medium break-words">{line}</td>
                          <td className="px-3 py-2.5">
                            {hit ? (
                              <span className="inline-flex items-center gap-1 font-medium text-primary">
                                <Check aria-hidden className="size-4" />
                                Yes
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-muted-foreground">
                            {hit ? formatTime(hit.checkedInAt) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
                  <Users aria-hidden className="size-6 text-muted-foreground" />
                  <p className="text-sm font-medium">No check-ins for this event</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Major</th>
                        <th className="px-3 py-2 font-medium">Year</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Checked in</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((attendee) => (
                        <tr key={attendee.id}>
                          <td className="px-3 py-2.5 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              {attendee.name}
                              {attendee.sfsuVerified && (
                                <BadgeCheck aria-label="Verified SFSU email" className="size-4 text-primary" />
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{attendee.major}</td>
                          <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                            {attendee.gradYear ?? ""}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-muted-foreground">
                            {formatTime(attendee.checkedInAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
