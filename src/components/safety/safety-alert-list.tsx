"use client";

// Mobbin was not reachable in this session. Reference from memory: GitHub Status
// (an active incident sits in its own outlined block above the history).

import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { alertCategoryLabel, type SafetyAlert } from "@/lib/db-safety";
import { alertTime } from "./alert-utils";
import { useSafetyAlerts } from "./use-safety-alerts";

const LINK =
  "inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function AlertItem({ alert, now }: { alert: SafetyAlert; now: number }) {
  return (
    <li className="space-y-1.5 px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-red-600" />
        {alertCategoryLabel(alert.category)}
      </p>
      <p className="font-medium text-pretty break-words">{alert.title}</p>
      {alert.details && <p className="text-pretty break-words text-muted-foreground">{alert.details}</p>}
      <p className="text-sm text-muted-foreground tabular-nums">
        Happened at <time dateTime={alert.occurredAt}>{alertTime(alert.occurredAt, now)}</time>, shown
        until <time dateTime={alert.expiresAt}>{alertTime(alert.expiresAt, now)}</time>
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground tabular-nums">
        <span>Posted by Campus safety at {alertTime(alert.createdAt, now)}</span>
        <Link href={`/map?alert=${alert.id}`} className={LINK}>
          <MapPin aria-hidden="true" className="size-3.5" />
          Show on map
        </Link>
      </p>
    </li>
  );
}

// Active alerts from campus safety staff, live. Sits above the police notices on /safety.
export function SafetyAlertList() {
  const { alerts, now, loading, error, reload } = useSafetyAlerts();

  return (
    <section aria-labelledby="alerts-heading" className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h2 id="alerts-heading" className="font-heading text-lg font-medium">
          Active alerts
        </h2>
        <p className="text-sm text-muted-foreground">Posted by Campus safety</p>
      </div>

      {loading ? (
        <div aria-busy="true" className="rounded-xl border px-4 py-3.5">
          <p role="status" className="sr-only">
            Loading alerts
          </p>
          <Skeleton className="h-4 w-28 motion-reduce:animate-none" />
          <Skeleton className="mt-2 h-5 w-64 max-w-full motion-reduce:animate-none" />
        </div>
      ) : error && alerts.length === 0 ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm">
          <span>Could not load alerts.</span>
          <Button variant="outline" size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : alerts.length === 0 ? (
        <p className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">No active alerts.</p>
      ) : (
        <ul className="divide-y divide-red-600/20 rounded-xl border border-red-600/40 bg-red-600/[0.04]">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}
