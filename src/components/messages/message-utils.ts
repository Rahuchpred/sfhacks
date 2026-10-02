import type { ConversationKind } from "@/lib/db-messages";

export const KIND_LABELS: Record<ConversationKind, string> = {
  question: "Event",
  announcement: "Announcement",
  help: "Help board",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const longDayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Whole days between two moments, by the calendar and not by 24 hour blocks.
function daysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
}

export function clockTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

// For an inbox row: the time today, the weekday this week, the date before that.
export function shortTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = daysAgo(date, now);
  if (days <= 0) return timeFormat.format(date);
  if (days < 7) return weekdayFormat.format(date);
  return dayFormat.format(date);
}

// For the line between two days in a thread.
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = daysAgo(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return longDayFormat.format(date);
}

export function sameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
