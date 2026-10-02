import type { Building, CampusEvent } from "@shared/types";

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function isHappeningNow(event: Pick<CampusEvent, "startsAt" | "endsAt">, now: number): boolean {
  return Date.parse(event.startsAt) <= now && now <= Date.parse(event.endsAt);
}

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dayLabel(iso: string, now: number): string {
  const days = Math.round((startOfDay(Date.parse(iso)) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return dayFormat.format(new Date(iso));
}

export function formatTimeRange(event: CampusEvent, now: number): string {
  const startDay = dayLabel(event.startsAt, now);
  const endDay = dayLabel(event.endsAt, now);
  const end = startDay === endDay ? formatTime(event.endsAt) : `${endDay}, ${formatTime(event.endsAt)}`;
  return `${startDay}, ${formatTime(event.startsAt)} to ${end}`;
}

export function placeLabel(building: Building | undefined, room: string | null): string {
  const name = building?.name ?? "On campus";
  return room ? `${name}, ${room}` : name;
}

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social",
  cultural: "Cultural",
  academic: "Academic",
  career: "Career",
  sports: "Sports",
  arts: "Arts",
  wellness: "Wellness",
  volunteer: "Volunteer",
};

export function categoryLabel(tags: string[]): string | null {
  for (const tag of tags) {
    const label = CATEGORY_LABELS[tag];
    if (label) return label;
  }
  return null;
}

export function isSfsuEmail(email: string): boolean {
  return /@(mail\.)?sfsu\.edu$/i.test(email.trim());
}

export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
