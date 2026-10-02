import type { Building, CampusEvent, FoodRescue } from "@/lib/types";

// One selection shared by the list, the map and the detail panel.
// "building" is a pin that holds several items.
export type Selection =
  | { kind: "event"; id: string }
  | { kind: "rescue"; id: string }
  | { kind: "building"; id: string }
  | null;

// What the pointer is over, shared by the list and the map so each can light up the other.
// Without an id it means the whole pin: every event (or rescue) at that building.
// The source says which side the pointer is on, so the other side is the one that reacts.
export type Hover = {
  kind: "event" | "rescue";
  buildingId: string;
  id?: string;
  source: "list" | "map";
} | null;

export function isHovered(
  hover: Hover,
  kind: "event" | "rescue",
  buildingId: string,
  id: string,
): boolean {
  if (!hover || hover.kind !== kind || hover.buildingId !== buildingId) return false;
  return hover.id === undefined || hover.id === id;
}

export type BuildingGroup = {
  building: Building;
  events: CampusEvent[];
  rescues: FoodRescue[];
};

export function groupByBuilding(
  buildings: Building[],
  events: CampusEvent[],
  rescues: FoodRescue[],
): BuildingGroup[] {
  const groups = new Map<string, BuildingGroup>(
    buildings.map((building) => [building.id, { building, events: [], rescues: [] }]),
  );
  for (const event of events) groups.get(event.buildingId)?.events.push(event);
  for (const rescue of rescues) groups.get(rescue.buildingId)?.rescues.push(rescue);
  return [...groups.values()].filter(
    (group) => group.events.length > 0 || group.rescues.length > 0,
  );
}

export function isHappeningNow(event: CampusEvent, now: number): boolean {
  return Date.parse(event.startsAt) <= now && now <= Date.parse(event.endsAt);
}

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

// "Today", "Tomorrow" or "Sat, Oct 3".
export function dayLabel(iso: string, now: number): string {
  const days = Math.round((startOfDay(Date.parse(iso)) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return dayFormat.format(new Date(iso));
}

// "Today, 3:00 PM to 5:00 PM"
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

export function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}
