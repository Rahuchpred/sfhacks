import type { CampusEvent, Club } from "@/lib/types";
import { isHappeningNow } from "@/components/map/map-utils";

// Up to two letters: the first letter of the first two words that start with one.
export function clubInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// SF State purple and gold, plus their tints. Gold never carries white text.
const AVATAR_TONES = [
  "bg-primary text-primary-foreground",
  "bg-accent text-accent-foreground",
  "bg-chart-3 text-white",
  "bg-chart-4 text-accent-foreground",
  "bg-chart-5 text-white",
  "bg-sidebar-accent text-sidebar-accent-foreground",
];

// The same club always gets the same color, on every page.
export function clubTone(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export type ClubSummary = {
  club: Club;
  upcoming: number; // events that have not ended, including one on now
  next: CampusEvent | null;
  live: boolean;
};

// One pass over the upcoming events, so the directory needs no call per club.
export function summarizeClubs(clubs: Club[], events: CampusEvent[], now: number): ClubSummary[] {
  const byClub = new Map<string, CampusEvent[]>();
  for (const event of events) {
    if (!event.clubId || Date.parse(event.endsAt) < now) continue;
    const list = byClub.get(event.clubId);
    if (list) list.push(event);
    else byClub.set(event.clubId, [event]);
  }

  const summaries = clubs.map((club) => {
    const list = (byClub.get(club.id) ?? []).sort(
      (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );
    return {
      club,
      upcoming: list.length,
      next: list[0] ?? null,
      live: list.some((event) => isHappeningNow(event, now)),
    };
  });

  // Soonest next event first, then clubs with nothing planned, each by name.
  return summaries.sort((a, b) => {
    const aStart = a.next ? Date.parse(a.next.startsAt) : Infinity;
    const bStart = b.next ? Date.parse(b.next.startsAt) : Infinity;
    if (aStart !== bStart) return aStart < bStart ? -1 : 1;
    return a.club.name.localeCompare(b.club.name);
  });
}

export function matchesClub(summary: ClubSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${summary.club.name} ${summary.next?.title ?? ""}`.toLowerCase().includes(needle);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A link with a broken id is "not found", not a database error.
export function isClubId(id: string): boolean {
  return UUID.test(id);
}

export type ClubTotals = { held: number; registered: number; checkedIn: number };

// Public counters only. An event counts as held once it has started.
export function clubTotals(events: CampusEvent[], now: number): ClubTotals {
  return events.reduce<ClubTotals>(
    (totals, event) => ({
      held: totals.held + (Date.parse(event.startsAt) <= now ? 1 : 0),
      registered: totals.registered + event.rsvpCount,
      checkedIn: totals.checkedIn + event.checkedInCount,
    }),
    { held: 0, registered: 0, checkedIn: 0 },
  );
}

// Upcoming soonest first, past newest first.
export function splitEvents(events: CampusEvent[], now: number) {
  const upcoming = events
    .filter((event) => Date.parse(event.endsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const past = events
    .filter((event) => Date.parse(event.endsAt) < now)
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  return { upcoming, past };
}

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short" });
const pastDayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function monthLabel(iso: string): string {
  return monthFormat.format(new Date(iso));
}

export function dayNumber(iso: string): number {
  return new Date(iso).getDate();
}

// "Fri, Sep 18, 2026": a past event needs its real date, never "Today".
export function pastDayLabel(iso: string): string {
  return pastDayFormat.format(new Date(iso));
}
