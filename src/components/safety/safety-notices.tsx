"use client";

// Mobbin reference: Canny's changelog page (date in a narrow left column, a
// small category label over each entry, entries separated by hairlines).

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, LoaderCircle, Phone, RefreshCw, Shield, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listSafetyNotices } from "@/lib/db";
import type { SafetyNotice } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatNoticeDate } from "./safety-utils";

const EMERGENCY = [
  { label: "Emergency", number: "911", href: "tel:911" },
  { label: "University Police", number: "(415) 338-7200", href: "tel:+14153387200" },
];

const RESOURCES = [
  { name: "University Police", href: "https://upd.sfsu.edu/" },
  { name: "Counseling and Psychological Services", href: "https://caps.sfsu.edu/" },
  { name: "Title IX office", href: "https://titleix.sfsu.edu/" },
];

const LINK =
  "inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

const ROW = "grid gap-x-6 gap-y-2 py-5 first:pt-0 sm:grid-cols-[7.5rem_1fr]";

type State = { notices: SafetyNotice[]; loading: boolean; error: string | null };
type Refresh = "idle" | "pending" | "done";

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function formatUpdated(notices: SafetyNotice[]): string | null {
  const times = notices.map((notice) => Date.parse(notice.fetchedAt)).filter(Number.isFinite);
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EmergencyNumbers() {
  return (
    <section aria-labelledby="emergency-heading" className="rounded-xl border bg-muted/50 p-4">
      <h2 id="emergency-heading" className="text-sm font-medium">
        In an emergency, call
      </h2>
      <ul className="mt-3 flex flex-col gap-2 sm:flex-row">
        {EMERGENCY.map((line) => (
          <li key={line.href} className="sm:flex-1">
            <a
              href={line.href}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 w-full justify-start gap-3 px-3",
              )}
            >
              <Phone aria-hidden="true" className="text-muted-foreground" />
              <span className="text-muted-foreground">{line.label}</span>
              <span className="ml-auto text-base font-semibold tabular-nums">{line.number}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SupportResources() {
  return (
    <aside aria-labelledby="support-heading" className="lg:sticky lg:top-6 lg:self-start">
      <h2 id="support-heading" className="font-heading text-lg font-medium">
        Support
      </h2>
      <ul className="mt-3 divide-y overflow-hidden rounded-xl border">
        {RESOURCES.map((resource) => (
          <li key={resource.href}>
            <a
              href={resource.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none"
            >
              <span className="min-w-0 text-pretty">{resource.name}</span>
              <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function NoticeItem({ notice }: { notice: SafetyNotice }) {
  return (
    <li className={ROW}>
      <p className="text-sm text-muted-foreground tabular-nums sm:pt-0.5">
        {notice.occurredOn ? (
          <time dateTime={notice.occurredOn}>{formatNoticeDate(notice.occurredOn)}</time>
        ) : (
          formatNoticeDate(null)
        )}
      </p>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant="secondary" className="h-auto max-w-full whitespace-normal">
            {notice.category}
          </Badge>
          {notice.area && <span className="text-sm break-words text-muted-foreground">{notice.area}</span>}
        </div>
        <p className="text-pretty break-words">{notice.summary}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>From University Police</span>
          <a href={notice.sourceUrl} target="_blank" rel="noreferrer" className={LINK}>
            Official notice
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </p>
      </div>
    </li>
  );
}

function NoticeSkeleton() {
  const pulse = "motion-reduce:animate-none";
  return (
    <div className={ROW}>
      <Skeleton className={cn("h-4 w-24", pulse)} />
      <div className="space-y-2">
        <Skeleton className={cn("h-5 w-40", pulse)} />
        <Skeleton className={cn("h-4 w-full", pulse)} />
        <Skeleton className={cn("h-4 w-3/4", pulse)} />
        <Skeleton className={cn("h-4 w-56", pulse)} />
      </div>
    </div>
  );
}

export function SafetyNotices() {
  const [state, setState] = useState<State>({ notices: [], loading: true, error: null });
  const [refresh, setRefresh] = useState<Refresh>("idle");

  const load = useCallback(async () => {
    try {
      const notices = await listSafetyNotices();
      setState({ notices, loading: false, error: null });
    } catch (error) {
      const message = errorMessage(error, "Could not load safety notices.");
      setState((current) => ({ ...current, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listSafetyNotices()
      .then((notices) => {
        if (!cancelled) setState({ notices, loading: false, error: null });
      })
      .catch((error: unknown) => {
        const message = errorMessage(error, "Could not load safety notices.");
        if (!cancelled) setState((current) => ({ ...current, loading: false, error: message }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The "Up to date" confirmation steps back to the idle label on its own.
  useEffect(() => {
    if (refresh !== "done") return;
    const timer = window.setTimeout(() => setRefresh("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function checkForNew() {
    if (refresh === "pending") return;
    setRefresh("pending");
    try {
      const response = await fetch("/api/safety/refresh", { method: "POST" });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const detail = body && typeof body === "object" && "error" in body ? body.error : null;
        throw new Error(typeof detail === "string" ? detail : `The check failed (${response.status}).`);
      }
      await load();
      setRefresh("done");
    } catch (error) {
      setRefresh("idle");
      toast.error("Could not check for new notices", {
        description: errorMessage(error, "Try again in a moment."),
      });
    }
  }

  function retry() {
    setState((current) => ({ ...current, loading: true, error: null }));
    load();
  }

  const { notices, loading, error } = state;
  const updated = formatUpdated(notices);
  const pending = refresh === "pending";

  return (
    <div className="space-y-8">
      <EmergencyNumbers />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="notices-heading" className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-3">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 id="notices-heading" className="font-heading text-lg font-medium">
                Recent notices
              </h2>
              {updated && (
                <p className="text-sm text-muted-foreground tabular-nums">Last updated {updated}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 sm:h-7 sm:px-2.5"
              disabled={pending || loading}
              aria-busy={pending}
              onClick={checkForNew}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
              ) : refresh === "done" ? (
                <Check aria-hidden="true" />
              ) : (
                <RefreshCw aria-hidden="true" />
              )}
              {pending ? "Checking, about 30 seconds" : refresh === "done" ? "Up to date" : "Check for new notices"}
            </Button>
            <p role="status" className="sr-only">
              {pending ? "Checking for new notices" : refresh === "done" ? "Notices are up to date" : ""}
            </p>
          </div>

          {loading ? (
            <div aria-busy="true" className="divide-y">
              <p role="status" className="sr-only">
                Loading safety notices
              </p>
              {Array.from({ length: 3 }, (_, index) => (
                <NoticeSkeleton key={index} />
              ))}
            </div>
          ) : error && notices.length === 0 ? (
            <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
              <TriangleAlert aria-hidden="true" className="size-6 text-muted-foreground" />
              <p className="text-base font-medium">Could not load safety notices.</p>
              <p className="text-sm text-pretty break-words text-muted-foreground">{error}</p>
              <Button variant="outline" size="lg" className="h-10 px-4" onClick={retry}>
                Try again
              </Button>
            </div>
          ) : notices.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Shield aria-hidden="true" className="size-6 text-muted-foreground" />
              </div>
              <p className="text-base font-medium">No recent notices from University Police</p>
            </div>
          ) : (
            <>
              {error && (
                <p role="status" className="mb-5 rounded-lg border bg-muted/50 p-3 text-sm text-pretty break-words">
                  Could not refresh, so this list may be out of date. {error}
                </p>
              )}
              <ul className="divide-y">
                {notices.map((notice) => (
                  <NoticeItem key={notice.id} notice={notice} />
                ))}
              </ul>
            </>
          )}
        </section>

        <SupportResources />
      </div>
    </div>
  );
}
