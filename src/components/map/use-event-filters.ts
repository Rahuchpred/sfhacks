"use client";

import { useEffect, useMemo, useState } from "react";
import type { Building, CampusEvent, Club, FoodRescue } from "@/lib/types";
import { endOfDay, isHappeningNow } from "./map-utils";

export type TimeFilter = "all" | "now" | "soon" | "today" | "week";

const WEEK_MS = 7 * 24 * 3600_000;
const SOON_MS = 2 * 3600_000;
const FOOD_TAG = "free food";

export const TIME_LABELS: Record<Exclude<TimeFilter, "all">, string> = {
  now: "Now",
  soon: "Starting soon",
  today: "Today",
  week: "This week",
};

// The current time, refreshed on an interval so "Now" stays correct while the page is open.
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

type FilterInput = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
  now: number;
  clubs?: Club[];
  // Ids of the events the signed-in student registered for. Null when signed out.
  myEventIds?: ReadonlySet<string> | null;
};

export type ActiveFilter = {
  key: string;
  label: string;
  tone: "event" | "food";
  remove: () => void;
};

export function useEventFilters({
  buildings,
  events,
  rescues,
  now,
  clubs,
  myEventIds = null,
}: FilterInput) {
  const [time, setTime] = useState<TimeFilter>("all");
  const [foodOnly, setFoodOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [rawClubId, setClubId] = useState<string | null>(null);
  const [rawBuildingId, setBuildingId] = useState<string | null>(null);

  // Search matches the building name and its aliases, so "CCSC" finds the Student Center.
  const buildingText = useMemo(
    () =>
      new Map(
        buildings.map((building) => [
          building.id,
          [building.name, ...building.aliases].join(" ").toLowerCase(),
        ]),
      ),
    [buildings],
  );

  const availableTags = useMemo(() => {
    const all = new Set(events.flatMap((event) => event.tags));
    all.delete(FOOD_TAG); // covered by the Free food chip
    return [...all].sort();
  }, [events]);

  // Only offer choices that lead somewhere: clubs with an upcoming event, buildings with a pin.
  const availableClubs = useMemo(() => {
    const used = new Set(events.map((event) => event.clubId));
    return (clubs ?? [])
      .filter((club) => used.has(club.id))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [clubs, events]);

  const availableBuildings = useMemo(() => {
    const used = new Set([
      ...events.map((event) => event.buildingId),
      ...rescues.map((rescue) => rescue.buildingId),
    ]);
    return buildings
      .filter((building) => used.has(building.id))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [buildings, events, rescues]);

  // A choice that left the live data (its last event ended) stops filtering.
  const clubName = availableClubs.find((item) => item.id === rawClubId)?.name ?? null;
  const buildingName = availableBuildings.find((item) => item.id === rawBuildingId)?.name ?? null;
  const clubId = clubName === null ? null : rawClubId;
  const buildingId = buildingName === null ? null : rawBuildingId;
  const mineIds = mineOnly ? myEventIds : null;

  const needle = query.trim().toLowerCase();

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const starts = Date.parse(event.startsAt);
        if (time === "now" && !isHappeningNow(event, now)) return false;
        if (time === "soon" && (starts <= now || starts > now + SOON_MS)) return false;
        if (time === "today" && starts > endOfDay(now)) return false;
        if (time === "week" && starts > now + WEEK_MS) return false;
        if (foodOnly && !event.hasFood) return false;
        if (mineIds && !mineIds.has(event.id)) return false;
        if (clubId && event.clubId !== clubId) return false;
        if (buildingId && event.buildingId !== buildingId) return false;
        if (tags.length > 0 && !tags.some((tag) => event.tags.includes(tag))) return false;
        if (!needle) return true;
        const haystack = `${event.title} ${event.clubName} ${buildingText.get(event.buildingId) ?? ""}`;
        return haystack.toLowerCase().includes(needle);
      }),
    [events, time, foodOnly, mineIds, clubId, buildingId, tags, needle, now, buildingText],
  );

  // Rescues are always "now" and always food. Tags, "starting soon" and "registered" are
  // about events, so they hide rescues. A club filter keeps the food from that club's events.
  const filteredRescues = useMemo(() => {
    const clubEventIds = clubId
      ? new Set(events.filter((event) => event.clubId === clubId).map((event) => event.id))
      : null;
    return rescues.filter((rescue) => {
      if (tags.length > 0 || mineIds || time === "soon") return false;
      if (clubEventIds && !(rescue.eventId && clubEventIds.has(rescue.eventId))) return false;
      if (buildingId && rescue.buildingId !== buildingId) return false;
      if (!needle) return true;
      const haystack = `${rescue.items} ${buildingText.get(rescue.buildingId) ?? ""}`;
      return haystack.toLowerCase().includes(needle);
    });
  }, [rescues, events, tags, mineIds, time, clubId, buildingId, needle, buildingText]);

  const toggleTag = (tag: string) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((other) => other !== tag) : [...current, tag],
    );

  // Everything that is narrowing the list right now, each with its own way out.
  const chips: ActiveFilter[] = [];
  const add = (key: string, label: string, remove: () => void, tone: "event" | "food" = "event") =>
    chips.push({ key, label, tone, remove });
  if (needle) add("query", `"${query.trim()}"`, () => setQuery(""));
  if (time !== "all") add("time", TIME_LABELS[time], () => setTime("all"));
  if (foodOnly) add("food", "Free food", () => setFoodOnly(false), "food");
  if (mineIds) add("mine", "Registered", () => setMineOnly(false));
  if (clubName !== null) add("club", clubName, () => setClubId(null));
  if (buildingName !== null) add("building", buildingName, () => setBuildingId(null));
  for (const tag of tags) {
    add(`tag:${tag}`, tag.charAt(0).toUpperCase() + tag.slice(1), () => toggleTag(tag));
  }

  return {
    time,
    setTime,
    foodOnly,
    setFoodOnly,
    mineOnly: mineIds !== null,
    setMineOnly,
    canFilterMine: myEventIds !== null,
    tags,
    toggleTag,
    query,
    setQuery,
    clubId,
    setClubId,
    buildingId,
    setBuildingId,
    availableTags,
    availableClubs,
    availableBuildings,
    chips,
    active: chips.length > 0,
    clear: () => {
      setTime("all");
      setFoodOnly(false);
      setMineOnly(false);
      setTags([]);
      setQuery("");
      setClubId(null);
      setBuildingId(null);
    },
    events: filteredEvents,
    rescues: filteredRescues,
  };
}

export type EventFilters = ReturnType<typeof useEventFilters>;
