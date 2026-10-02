// Small helpers shared by the host dashboard, manage page and check-in page.
import type { Building, CampusEvent } from "@/lib/types";

export type EventPhase = "upcoming" | "now" | "past";

export function eventPhase(event: CampusEvent, now: number): EventPhase {
  if (Date.parse(event.endsAt) <= now) return "past";
  return Date.parse(event.startsAt) <= now ? "now" : "upcoming";
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const clockFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const stampFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// "5:02 PM"
export function formatClock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : clockFormat.format(date);
}

// "Oct 8, 5:02 PM"
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : stampFormat.format(date);
}

// "Thu, Oct 8, 5:00 PM to 7:00 PM". The end date is added when it differs.
export function formatEventTime(event: Pick<CampusEvent, "startsAt" | "endsAt">): string {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const sameDay = start.toDateString() === end.toDateString();
  const endLabel = sameDay
    ? clockFormat.format(end)
    : `${dayFormat.format(end)}, ${clockFormat.format(end)}`;
  return `${dayFormat.format(start)}, ${clockFormat.format(start)} to ${endLabel}`;
}

// "Cesar Chavez Student Center, Rosa Parks A-C", or "Campus" with no building.
export function placeLabel(building: Building | undefined, room: string | null): string {
  const name = building?.name ?? "Campus";
  return room ? `${name}, ${room}` : name;
}

// Share of registered guests who checked in, 0 to 100. Null when nobody registered.
export function turnoutRate(checkedIn: number, going: number): number | null {
  if (going <= 0) return null;
  return Math.min(100, Math.round((checkedIn / going) * 100));
}
