// Event checks done in code, so they are exact and never depend on the model.
// Only these can block publishing. Model findings are added as warnings.
import type { Building, EventDraft, EventIssue } from "@/lib/types";

export const TIMEZONE = "America/Los_Angeles";

export const EVENT_TAGS = [
  "social",
  "cultural",
  "academic",
  "career",
  "sports",
  "arts",
  "wellness",
  "volunteer",
  "free food",
] as const;

// "sat" and "sun" are left out: they are common words and would cause false alarms.
const WEEKDAY_PATTERNS: [RegExp, string][] = [
  [/\bsundays?\b/i, "sunday"],
  [/\b(mon|mondays?)\b/i, "monday"],
  [/\b(tue|tues|tuesdays?)\b/i, "tuesday"],
  [/\b(wed|weds|wednesdays?)\b/i, "wednesday"],
  [/\b(thu|thur|thurs|thursdays?)\b/i, "thursday"],
  [/\b(fri|fridays?)\b/i, "friday"],
  [/\bsaturdays?\b/i, "saturday"],
];

const ALLERGEN_WORDS = /allerg|nut|gluten|dairy|vegan|vegetarian|halal|kosher/i;

const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "long" });
const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  month: "short",
  day: "numeric",
});

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function mentionedWeekdays(text: string): string[] {
  return WEEKDAY_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, day]) => day);
}

export function checkEventDraft(
  event: EventDraft,
  buildings: Building[],
  now: Date = new Date(),
): EventIssue[] {
  const issues: EventIssue[] = [];
  const error = (field: string, message: string) =>
    issues.push({ field, message, severity: "error" });
  const warn = (field: string, message: string) =>
    issues.push({ field, message, severity: "warn" });

  if (!event.title?.trim()) error("title", "Add a title.");

  if (!event.buildingId) {
    error("buildingId", "Pick a building.");
  } else if (!buildings.some((building) => building.id === event.buildingId)) {
    error("buildingId", "That building is not on the campus list. Pick one from the list.");
  }

  if (!event.room?.trim()) {
    warn("room", "No room number. That is fine for outdoor events, otherwise add one.");
  }

  const start = parseDate(event.startsAt);
  const end = parseDate(event.endsAt);

  if (!start) error("startsAt", "Add a start date and time.");
  if (!end) error("endsAt", "Add an end time.");

  if (start && end) {
    if (end <= start) {
      error("endsAt", "The end time is before the start time.");
    } else if (end.getTime() - start.getTime() > 24 * 3600_000) {
      warn("endsAt", "This event runs longer than a day. Check the end time.");
    }
    if (end < now) {
      error("startsAt", `This event already ended (${dateFormat.format(end)}). Check the date.`);
    }
  }

  if (start) {
    const actual = weekdayFormat.format(start).toLowerCase();
    const mentioned = mentionedWeekdays(`${event.title ?? ""} ${event.description ?? ""}`);
    if (mentioned.length > 0 && !mentioned.includes(actual)) {
      error(
        "startsAt",
        `The text says ${mentioned.map(capitalize).join(" or ")}, but ${dateFormat.format(start)} is a ${capitalize(actual)}.`,
      );
    }
  }

  if (event.hasFood && !ALLERGEN_WORDS.test(event.description ?? "")) {
    warn("description", "There is food, but nothing about allergens or dietary options.");
  }

  return issues;
}

export function missingFields(event: EventDraft): string[] {
  const required: (keyof EventDraft)[] = ["title", "buildingId", "startsAt", "endsAt"];
  return required.filter((field) => !event[field]);
}
