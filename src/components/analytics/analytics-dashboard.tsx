"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Download, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { aiStats, buildAnalytics, schoolReportCsv } from "@/lib/analytics";
import { postJson } from "@/lib/api";
import {
  listHostAttendance,
  listMyClubs,
  listMyHostedEvents,
  listRescuesForEvents,
} from "@/lib/db";
import type {
  AttendanceRow,
  CampusEvent,
  FoodRescue,
  HostInsightsResponse,
  MyClub,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { CountBars, DonutChart, PercentBars, TurnoutChart } from "./charts";

// Mobbin reference: Calendly's Analytics page (filters and Export in one row,
// a row of stat cards, then a grid of chart cards, then a table).

const ALL = "all";
const SOLO = "solo";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ChartCard({
  title,
  empty,
  className,
  children,
}: {
  title: string;
  empty: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No check-ins yet.
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsDashboard() {
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [rescues, setRescues] = useState<FoodRescue[]>([]);
  const [clubs, setClubs] = useState<MyClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clubFilter, setClubFilter] = useState(ALL);
  const [eventFilter, setEventFilter] = useState(ALL);

  const [insights, setInsights] = useState<HostInsightsResponse | null>(null);
  const [insightsFor, setInsightsFor] = useState("");
  const [thinking, setThinking] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hosted, attendance, myClubs] = await Promise.all([
          listMyHostedEvents(),
          listHostAttendance(),
          listMyClubs(),
        ]);
        const food = await listRescuesForEvents(hosted.map((event) => event.id));
        if (cancelled) return;
        setEvents(hosted);
        setRows(attendance);
        setClubs(myClubs);
        setRescues(food);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load analytics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clubEvents = useMemo(
    () =>
      events.filter((event) =>
        clubFilter === ALL ? true : clubFilter === SOLO ? !event.clubId : event.clubId === clubFilter,
      ),
    [events, clubFilter],
  );
  const scopedEvents = useMemo(
    () => (eventFilter === ALL ? clubEvents : clubEvents.filter((event) => event.id === eventFilter)),
    [clubEvents, eventFilter],
  );
  const analytics = useMemo(
    () => buildAnalytics(scopedEvents, rows, rescues),
    [scopedEvents, rows, rescues],
  );

  const scopeKey = `${clubFilter}:${eventFilter}`;
  const shownInsights = insightsFor === scopeKey ? insights : null;
  const noCheckIns = analytics.totals.checkIns === 0;
  const upcoming = analytics.events.filter((event) => !event.started);
  const t = analytics.totals;

  async function writeInsights() {
    if (thinking) return;
    setThinking(true);
    setInsightsError(null);
    try {
      const result = await postJson<HostInsightsResponse>("/api/ai/host-insights", {
        stats: aiStats(analytics),
      });
      setInsights(result);
      setInsightsFor(scopeKey);
    } catch (insightError) {
      setInsightsError(
        insightError instanceof Error ? insightError.message : "Could not write insights.",
      );
    } finally {
      setThinking(false);
    }
  }

  function exportReport() {
    const csv = schoolReportCsv(analytics, scopedEvents, rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `gator-radar-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-6 py-8" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
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
        <p className="text-sm text-pretty text-muted-foreground">
          Post an event and check guests in at the door. The numbers show up here.
        </p>
        <Link href="/post" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
          Post an event
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold tracking-tight">Analytics</h1>

        <Select
          value={clubFilter}
          onValueChange={(value) => {
            setClubFilter(value ?? ALL);
            setEventFilter(ALL);
          }}
        >
          <SelectTrigger aria-label="Club" className="h-9 min-w-36">
            <SelectValue>
              {clubFilter === ALL
                ? "All clubs"
                : clubFilter === SOLO
                  ? "Just me"
                  : clubs.find((club) => club.id === clubFilter)?.name}
            </SelectValue>
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

        <Select value={eventFilter} onValueChange={(value) => setEventFilter(value ?? ALL)}>
          <SelectTrigger aria-label="Event" className="h-9 min-w-40 max-w-64">
            <SelectValue>
              {eventFilter === ALL
                ? "All events"
                : clubEvents.find((event) => event.id === eventFilter)?.title}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All events</SelectItem>
            {clubEvents.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" className="h-9" onClick={exportReport}>
          <Download aria-hidden />
          Export for school
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Events" value={String(t.events)} />
        <Stat label="Registered" value={String(t.registrations)} />
        <Stat label="Checked in" value={String(t.checkIns)} />
        <Stat
          label="Turnout"
          value={t.turnoutPct === null ? "n/a" : `${t.turnoutPct}%`}
          hint="of sign-ups showed up"
        />
        <Stat label="Students reached" value={String(t.uniqueStudents)} />
        <Stat
          label="Cost per attendee"
          value={t.costPerAttendee === null ? "n/a" : `$${t.costPerAttendee.toFixed(2)}`}
          hint={t.totalCost > 0 ? `$${t.totalCost.toFixed(0)} spent` : "add event costs"}
        />
      </div>

      <Card className="border-primary/20 bg-secondary/60">
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h2 className="flex items-center gap-1.5 font-medium">
                <Sparkles className="size-4 text-primary" aria-hidden />
                AI insights
              </h2>
              <p className="text-sm text-muted-foreground">
                Reads the numbers on this page. It never sees names.
              </p>
            </div>
            <Button onClick={writeInsights} disabled={thinking || noCheckIns} className="h-9">
              {thinking ? (
                <>
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                  Reading your data…
                </>
              ) : shownInsights ? (
                "Refresh"
              ) : (
                "Find insights"
              )}
            </Button>
          </div>

          <div aria-live="polite" className="empty:hidden">
            {insightsError && <p className="text-sm text-destructive">{insightsError}</p>}
            {noCheckIns && !shownInsights && (
              <p className="text-sm text-muted-foreground">
                Insights need at least one check-in to work from.
              </p>
            )}
            {shownInsights && (
              <div className="space-y-3">
                <ul className="grid gap-3 md:grid-cols-2">
                  {shownInsights.insights.map((insight) => (
                    <li key={insight.title} className="rounded-lg bg-card p-3.5">
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="mt-1 text-sm text-pretty text-muted-foreground">
                        {insight.detail}
                      </p>
                    </li>
                  ))}
                </ul>
                {shownInsights.nextEvent && (
                  <p className="rounded-lg border border-accent/50 bg-accent/15 p-3.5 text-sm text-pretty">
                    <span className="font-medium">For your next event: </span>
                    {shownInsights.nextEvent}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {(upcoming.length > 0 || analytics.food.foodEvents > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Expected turnout</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.showRate === null ? (
                  <p className="text-sm text-muted-foreground">
                    Shows once one of your events has check-ins to learn from.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {upcoming.map((event) => (
                      <li key={event.id} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">{event.title}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {event.registered} signed up, expect about{" "}
                          <span className="font-medium text-foreground">
                            {event.predictedCheckIns}
                          </span>
                        </span>
                      </li>
                    ))}
                    <li className="pt-1 text-xs text-muted-foreground">
                      Based on your past events: {Math.round(analytics.showRate * 100)}% of
                      sign-ups check in.
                    </li>
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {analytics.food.foodEvents > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Food you over-ordered</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <p>
                  <span className="text-2xl font-semibold tabular-nums">
                    {analytics.food.avgLeftover}
                  </span>{" "}
                  extra portions per event, on average across {analytics.food.foodEvents}{" "}
                  {analytics.food.foodEvents === 1 ? "event" : "events"} with leftovers.
                </p>
                <p className="text-muted-foreground">
                  Students rescued {t.portionsClaimed} of the {t.leftoverPortions} you posted. You
                  ordered about {Math.round(analytics.food.avgLeftover ?? 0)} more than people ate,
                  so order that many fewer next time.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Registered and checked in, by event"
          empty={t.registrations === 0}
          className="lg:col-span-2"
        >
          <TurnoutChart events={analytics.events} />
        </ChartCard>
        <ChartCard title="Who came, by major" empty={noCheckIns}>
          <DonutChart data={analytics.byMajor} unit="students" />
        </ChartCard>
        <ChartCard title="Who came, by graduation year" empty={noCheckIns}>
          <CountBars data={analytics.byYear} label="Students" />
        </ChartCard>
        <ChartCard title="First time or came back" empty={noCheckIns}>
          <DonutChart data={analytics.loyalty} unit="students" />
        </ChartCard>
        <ChartCard title="When people arrive" empty={noCheckIns}>
          <CountBars data={analytics.arrival} label="Check-ins" color="var(--accent)" />
        </ChartCard>
        <ChartCard title="Turnout by weekday" empty={analytics.byWeekday.length === 0}>
          <PercentBars data={analytics.byWeekday} />
        </ChartCard>
        <ChartCard title="Turnout by time of day" empty={analytics.byTimeOfDay.length === 0}>
          <PercentBars data={analytics.byTimeOfDay} />
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            People ({analytics.people.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.people.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nobody has registered yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Major</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Class</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Signed up</th>
                    <th scope="col" className="py-2 text-right font-medium">Showed up</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {analytics.people.map((person) => (
                    <tr key={person.guestId}>
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-1.5 font-medium">
                          {person.name}
                          {person.verified && (
                            <BadgeCheck
                              className="size-4 text-primary"
                              aria-label="Verified SFSU student"
                            />
                          )}
                          {person.attended > 1 && <Badge variant="secondary">Regular</Badge>}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {person.major || "Not given"}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground tabular-nums">
                        {person.gradYear ?? "Not given"}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{person.registered}</td>
                      <td className="py-2.5 text-right tabular-nums">{person.attended}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
