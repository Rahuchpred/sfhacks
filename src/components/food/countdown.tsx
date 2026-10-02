"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const URGENT_MS = 15 * 60 * 1000;
const SHOW_SECONDS_MS = 10 * 60 * 1000;

const clockFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const absoluteFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

// One ticking clock. Call it once per screen and pass `now` down, so every
// countdown flips on the same tick.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}

// "3:30 PM" in the visitor's locale and time zone.
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return clockFormat.format(date);
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min left`;
  if (ms >= SHOW_SECONDS_MS) return `${minutes} min left`;
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, "0")} s left`;
  return `${seconds} s left`;
}

export function Countdown({
  until,
  now,
  className,
}: {
  until: string;
  now: number;
  className?: string;
}) {
  const target = Date.parse(until);
  if (Number.isNaN(target)) return null;

  const remaining = target - now;
  const urgent = remaining < URGENT_MS;

  // No aria-live here on purpose: this text changes every second.
  return (
    <time
      dateTime={until}
      title={absoluteFormat.format(target)}
      className={cn("tabular-nums", urgent && "font-medium text-destructive", className)}
    >
      {remaining <= 0 ? "Time is up" : formatRemaining(remaining)}
    </time>
  );
}

// "14:05" for a pickup hold. Minutes and seconds, since a hold lasts 15 minutes.
export function formatTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const HOLD_URGENT_MS = 3 * 60 * 1000;

// The time left on a pickup hold. Turns red for the last three minutes.
export function HoldTimer({
  until,
  now,
  className,
}: {
  until: string;
  now: number;
  className?: string;
}) {
  const target = Date.parse(until);
  if (Number.isNaN(target)) return null;

  const remaining = target - now;

  return (
    <time
      dateTime={until}
      title={absoluteFormat.format(target)}
      className={cn(
        "tabular-nums",
        remaining < HOLD_URGENT_MS && "text-destructive",
        className,
      )}
    >
      {remaining <= 0 ? "Expired" : `${formatTimer(remaining)} left`}
    </time>
  );
}
