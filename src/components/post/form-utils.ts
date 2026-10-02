// Small helpers shared by the event form and its pickers.
import { useEffect } from "react";
import { TIMEZONE } from "@/lib/checks";

const pad = (n: number) => String(n).padStart(2, "0");

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Campus wall-clock time for an instant: date "YYYY-MM-DD" and time "HH:mm".
export function pacificParts(instant: Date | string | null): { date: string; time: string } | null {
  if (!instant) return null;
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return null;
  const part: Record<string, string> = {};
  for (const { type, value } of partsFormat.formatToParts(date)) part[type] = value;
  return {
    date: `${part.year}-${part.month}-${part.day}`,
    time: `${part.hour}:${part.minute}`,
  };
}

// The wall-clock parts read as if they were UTC, to measure the zone offset.
function asUtc(date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour, minute);
}

// Campus date and time to an ISO string with the Pacific offset,
// for example "2026-10-08T17:00:00-07:00". Null when either part is missing.
export function pacificIso(date: string, time: string, addDays = 0): string | null {
  if (!date || !time) return null;
  const wall = asUtc(date, time) + addDays * 86_400_000;
  if (Number.isNaN(wall)) return null;
  const offsetAt = (instant: number) => {
    const parts = pacificParts(new Date(instant));
    return parts ? asUtc(parts.date, parts.time) - instant : 0;
  };
  // Two passes, so the offset is right on the days the clocks change.
  const offset = offsetAt(wall - offsetAt(wall));
  const local = new Date(wall).toISOString().slice(0, 19);
  const minutes = Math.abs(offset) / 60_000;
  return `${local}${offset <= 0 ? "-" : "+"}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

// "HH:mm" to minutes after midnight and back.
export function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function fromMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

// "17:30" to "5:30 PM".
export function timeLabel(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`;
}

// Whole days between two "YYYY-MM-DD" dates.
export function daysBetween(from: string, to: string): number {
  return Math.round((asUtc(to, "00:00") - asUtc(from, "00:00")) / 86_400_000);
}

// POSTs JSON to an AI route. Throws with the route's own error message.
export async function postJson<Req, Res>(url: string, body: Req): Promise<Res> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed (${response.status}).`);
  }
  return data as Res;
}

// Asks the browser to confirm before leaving while a form has unsaved input.
export function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

const MAX_ERROR_LENGTH = 160;

export function errorMessage(error: unknown, fallback: string): string {
  // Supabase errors are plain objects with a message, not Error instances.
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message !== "string" || !message) return fallback;
  // A raw provider reply (a JSON dump, a quota notice) is not something to show a person.
  return message.length > MAX_ERROR_LENGTH || /^\s*[{[]/.test(message) ? fallback : message;
}
