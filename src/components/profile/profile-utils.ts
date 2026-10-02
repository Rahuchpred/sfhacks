import { useEffect } from "react";
import type { TicketWithEvent } from "@/lib/types";

export const BIO_LIMIT = 280;

// Tickets a club scanned at the door, newest event first.
export function attendedTickets(tickets: TicketWithEvent[]): TicketWithEvent[] {
  return tickets
    .filter((ticket) => ticket.checkedInAt)
    .sort((a, b) => b.event.startsAt.localeCompare(a.event.startsAt));
}

export type AttendanceStats = {
  events: number;
  clubs: number;
  topTags: string[];
};

export function attendanceStats(attended: TicketWithEvent[]): AttendanceStats {
  const clubs = new Set(
    attended.map((ticket) => ticket.event.clubName.trim().toLowerCase()).filter(Boolean),
  );
  const tagCounts = new Map<string, number>();
  for (const ticket of attended) {
    for (const tag of ticket.event.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([tag]) => tag);
  return { events: attended.length, clubs: clubs.size, topTags };
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

// "Sat, Oct 3, 2026"
export function formatEventDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

// Empty is fine (saved as null). Anything else must be an https:// link.
export function urlError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("https://")) return "Start the link with https://";
  if (!URL.canParse(trimmed)) return "This does not look like a link.";
  return null;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

// Asks the browser to confirm before leaving while there are unsaved changes.
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
