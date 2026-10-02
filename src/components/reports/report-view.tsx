"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, Copy, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listBuildings,
  listHostAttendance,
  listMyClubs,
  listMyHostedEvents,
  listRescuesForEvents,
} from "@/lib/db";
import {
  buildReport,
  checkInsTable,
  eventsTable,
  reportDate,
  reportPrintHtml,
  toCsv,
  toTsv,
  type ReportTotals,
} from "@/lib/reports";
import type { AttendanceRow, Building, CampusEvent, FoodRescue, MyClub } from "@/lib/types";
import { cn } from "@/lib/utils";

// Mobbin reference: Square "Timecards" report
// (https://mobbin.com/screens/db67dd90-e64c-4989-b7d3-f6dd06a0d8bb): the filter
// on the left and Export on the right in one row, a row of large quiet totals,
// then one plain table with right-aligned numbers.

const ALL = "all";
const SOLO = "solo";
type TabKey = "events" | "checkins";

const TH = "px-3 py-2 font-medium whitespace-nowrap";
const TD = "px-3 py-2.5";
const NUM = "text-right tabular-nums";
// Club and building fold under the event title on a phone, so the counts stay in view.
const WIDE = "hidden md:table-cell";

function percent(value: number | null): string {
  return value === null ? "n/a" : `${value}%`;
}

function money(value: number | null): string {
  if (value === null) return "";
  const cents = Number.isInteger(value) ? 0 : 2;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: cents, maximumFractionDigits: cents })}`;
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dd className="text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dt className="mt-0.5 text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

function TotalCells({ totals }: { totals: ReportTotals }) {
  return (
    <>
      <td className={cn(TD, NUM)}>{totals.registered}</td>
      <td className={cn(TD, NUM)}>{totals.checkedIn}</td>
      <td className={cn(TD, NUM)}>{percent(totals.turnoutPct)}</td>
      <td className={cn(TD, NUM)}>{totals.foodPosted}</td>
      <td className={cn(TD, NUM)}>{totals.foodClaimed}</td>
      <td className={cn(TD, NUM)}>{money(totals.cost)}</td>
    </>
  );
}

export function ReportView() {
  const userId = useUser()?.id;
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [rescues, setRescues] = useState<FoodRescue[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [clubs, setClubs] = useState<MyClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clubFilter, setClubFilter] = useState(ALL);
  const [tab, setTab] = useState<TabKey>("events");
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Waits for the session: on a first visit the sign-in finishes after the page mounts.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [hosted, attendance, myClubs, allBuildings] = await Promise.all([
          listMyHostedEvents(),
          listHostAttendance(),
          listMyClubs(),
          listBuildings(),
        ]);
        const food = await listRescuesForEvents(hosted.map((event) => event.id));
        if (cancelled) return;
        setEvents(hosted);
        setRows(attendance);
        setClubs(myClubs);
        setBuildings(allBuildings);
        setRescues(food);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the report.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const scopedEvents = useMemo(
    () =>
      events.filter((event) =>
        clubFilter === ALL ? true : clubFilter === SOLO ? !event.clubId : event.clubId === clubFilter,
      ),
    [events, clubFilter],
  );
  const report = useMemo(
    () => buildReport(scopedEvents, rows, rescues, buildings),
    [scopedEvents, rows, rescues, buildings],
  );

  const scopeLabel =
    clubFilter === ALL
      ? "All clubs"
      : clubFilter === SOLO
        ? "Just me"
        : (clubs.find((club) => club.id === clubFilter)?.name ?? "");
  const table = tab === "events" ? eventsTable(report) : checkInsTable(report);
  const nothingToExport = table.rows.length === 0;
  const today = reportDate();

  async function copyForSheets() {
    const text = toTsv(table);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers and pages without clipboard permission.
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) {
        toast.error("Could not copy. Use Download CSV.");
        return;
      }
    }
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    toast.success(`${table.rows.length} rows copied. Paste into cell A1.`);
  }

  function downloadCsv() {
    // The byte order mark makes Excel read accents in names correctly.
    const blob = new Blob(["﻿", toCsv(table)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gator-radar-${tab === "events" ? "events" : "check-ins"}-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Prints from a hidden frame so the sidebar and buttons never reach the paper.
  function print() {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
    frame.srcdoc = reportPrintHtml(report, scopeLabel, today);
    frame.onload = () => {
      const view = frame.contentWindow;
      if (!view) return;
      view.onafterprint = () => frame.remove();
      view.focus();
      view.print();
    };
    document.body.appendChild(frame);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6" aria-busy="true">
        <Skeleton className="h-8 w-40 motion-reduce:animate-none" />
        <Skeleton className="h-14 motion-reduce:animate-none" />
        <Skeleton className="h-80 motion-reduce:animate-none" />
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="mx-auto max-w-6xl px-6 py-16 text-center text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
        <h1 className="text-xl font-semibold tracking-tight">No events yet</h1>
        <Link href="/post" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
          Post an event
        </Link>
      </div>
    );
  }

  const t = report.totals;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <span className="text-xs text-muted-foreground">Unofficial</span>
        </div>

        {clubs.length > 0 && (
          <Select value={clubFilter} onValueChange={(value) => setClubFilter(value ?? ALL)}>
            <SelectTrigger aria-label="Club" className="h-9 min-w-36">
              <SelectValue>{scopeLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clubs</SelectItem>
              {clubs.map((club) => (
                <SelectItem key={club.id} value={club.id}>
                  {club.name}
                </SelectItem>
              ))}
              <SelectItem value={SOLO}>Just me</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-6">
        <Total label="Events" value={String(t.events)} />
        <Total label="Registered" value={String(t.registered)} />
        <Total label="Checked in" value={String(t.checkedIn)} />
        <Total label="Turnout" value={percent(t.turnoutPct)} />
        <Total label="Food claimed" value={`${t.foodClaimed}/${t.foodPosted}`} />
        <Total label="Cost" value={money(t.cost)} />
      </dl>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList className="mr-auto">
            <TabsTrigger value="events" className="px-3">
              Events
            </TabsTrigger>
            <TabsTrigger value="checkins" className="px-3">
              Check-ins
            </TabsTrigger>
          </TabsList>

          <Button className="h-9" onClick={copyForSheets} disabled={nothingToExport}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {/* Both labels share one grid cell, so the button keeps its width when it says "Copied". */}
            <span aria-live="polite" className="grid text-left">
              <span className={cn("col-start-1 row-start-1", !copied && "invisible")} aria-hidden={!copied}>
                Copied
              </span>
              <span className={cn("col-start-1 row-start-1", copied && "invisible")} aria-hidden={copied}>
                Copy for Google Sheets
              </span>
            </span>
          </Button>
          <Button variant="outline" className="h-9" onClick={downloadCsv} disabled={nothingToExport}>
            <Download aria-hidden />
            Download CSV
          </Button>
          <Button variant="outline" className="h-9" onClick={print}>
            <Printer aria-hidden />
            Print
          </Button>
        </div>

        <TabsContent value="events">
          {report.days.length === 0 ? (
            <p className="rounded-xl border py-12 text-center text-sm text-muted-foreground">
              No events for this club.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[34rem] text-sm md:min-w-[56rem]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className={TH}>Event</th>
                    <th scope="col" className={cn(TH, WIDE)}>Club</th>
                    <th scope="col" className={cn(TH, WIDE)}>Building</th>
                    <th scope="col" className={cn(TH, NUM)}>Registered</th>
                    <th scope="col" className={cn(TH, NUM)}>Checked in</th>
                    <th scope="col" className={cn(TH, NUM)}>Turnout</th>
                    <th scope="col" className={cn(TH, NUM)}>Food posted</th>
                    <th scope="col" className={cn(TH, NUM)}>Food claimed</th>
                    <th scope="col" className={cn(TH, NUM)}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((day) => (
                    <Fragment key={day.date}>
                      <tr className="border-b bg-muted/60 font-medium">
                        <th scope="rowgroup" className={cn(TD, "text-left font-medium whitespace-nowrap")}>
                          {day.label}
                          <span className="ml-2 hidden text-xs font-normal text-muted-foreground md:inline">
                            {day.totals.events} {day.totals.events === 1 ? "event" : "events"}
                          </span>
                        </th>
                        <td className={WIDE} colSpan={2} />
                        <TotalCells totals={day.totals} />
                      </tr>
                      {day.events.map((event) => (
                        <tr key={event.id} className="border-b last:border-b-0">
                          <td className={cn(TD, "max-w-40 md:max-w-72")}>
                            <Link
                              href={`/host/${event.id}`}
                              className="block truncate font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                            >
                              {event.title}
                            </Link>
                            <span className="block truncate text-xs text-muted-foreground">
                              {event.time}
                              <span className="md:hidden">
                                {event.building && `, ${event.building}`}
                              </span>
                            </span>
                          </td>
                          <td className={cn(TD, WIDE, "max-w-48 truncate text-muted-foreground")}>
                            {event.club}
                          </td>
                          <td className={cn(TD, WIDE, "max-w-48 truncate text-muted-foreground")}>
                            {event.building}
                          </td>
                          <td className={cn(TD, NUM)}>{event.registered}</td>
                          <td className={cn(TD, NUM)}>{event.checkedIn}</td>
                          <td className={cn(TD, NUM, !event.started && "text-muted-foreground")}>
                            {event.started ? percent(event.turnoutPct) : "Upcoming"}
                          </td>
                          <td className={cn(TD, NUM)}>{event.foodPosted}</td>
                          <td className={cn(TD, NUM)}>{event.foodClaimed}</td>
                          <td className={cn(TD, NUM)}>{money(event.cost)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <th scope="row" className={cn(TD, "text-left font-semibold")}>
                      Total
                    </th>
                    <td className={WIDE} colSpan={2} />
                    <TotalCells totals={t} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="checkins">
          {report.checkIns.length === 0 ? (
            <p className="rounded-xl border py-12 text-center text-sm text-muted-foreground">
              No check-ins yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className={TH}>Student</th>
                    <th scope="col" className={TH}>Event</th>
                    <th scope="col" className={TH}>Date</th>
                    <th scope="col" className={TH}>Major</th>
                    <th scope="col" className={TH}>Class</th>
                    <th scope="col" className={TH}>Registered at</th>
                    <th scope="col" className={TH}>Checked in at</th>
                  </tr>
                </thead>
                <tbody>
                  {report.checkIns.map((row) => (
                    <tr key={row.rsvpId} className="border-b last:border-b-0">
                      <td className={TD}>
                        <span className="flex items-center gap-1.5 font-medium">
                          {row.student}
                          {row.verified && (
                            <BadgeCheck
                              className="size-4 shrink-0 text-primary"
                              aria-label="Verified SFSU student"
                            />
                          )}
                        </span>
                      </td>
                      <td className={cn(TD, "max-w-64 truncate")}>{row.event}</td>
                      <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{row.date}</td>
                      <td className={cn(TD, "text-muted-foreground")}>{row.major}</td>
                      <td className={cn(TD, "text-muted-foreground tabular-nums")}>
                        {row.gradYear ?? ""}
                      </td>
                      <td className={cn(TD, "whitespace-nowrap text-muted-foreground tabular-nums")}>
                        {row.registeredAt}
                      </td>
                      <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{row.checkedInAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
