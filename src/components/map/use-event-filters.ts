"use client";

import { useEffect, useMemo, useState } from "react";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";
import { endOfDay, isHappeningNow } from "./map-utils";

export type TimeFilter = "all" | "now" | "today" | "week";

const WEEK_MS = 7 * 24 * 3600_000;
const FOOD_TAG = "free food";

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
};

export function useEventFilters({ buildings, events, rescues, now }: FilterInput) {
  const [time, setTime] = useState<TimeFilter>("all");
  const [foodOnly, setFoodOnly] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");

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

  const needle = query.trim().toLowerCase();

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const starts = Date.parse(event.startsAt);
        if (time === "now" && !isHappeningNow(event, now)) return false;
        if (time === "today" && starts > endOfDay(now)) return false;
        if (time === "week" && starts > now + WEEK_MS) return false;
        if (foodOnly && !event.hasFood) return false;
        if (tags.length > 0 && !tags.some((tag) => event.tags.includes(tag))) return false;
        if (!needle) return true;
        const haystack = `${event.title} ${event.clubName} ${buildingText.get(event.buildingId) ?? ""}`;
        return haystack.toLowerCase().includes(needle);
      }),
    [events, time, foodOnly, tags, needle, now, buildingText],
  );

  // Rescues are always "now" and always food. Tags do not apply to them.
  const filteredRescues = useMemo(
    () =>
      rescues.filter((rescue) => {
        if (tags.length > 0) return false;
        if (!needle) return true;
        const haystack = `${rescue.items} ${buildingText.get(rescue.buildingId) ?? ""}`;
        return haystack.toLowerCase().includes(needle);
      }),
    [rescues, tags, needle, buildingText],
  );

  const active = time !== "all" || foodOnly || tags.length > 0 || needle !== "";

  return {
    time,
    setTime,
    foodOnly,
    setFoodOnly,
    tags,
    toggleTag: (tag: string) =>
      setTags((current) =>
        current.includes(tag) ? current.filter((other) => other !== tag) : [...current, tag],
      ),
    query,
    setQuery,
    availableTags,
    active,
    clear: () => {
      setTime("all");
      setFoodOnly(false);
      setTags([]);
      setQuery("");
    },
    events: filteredEvents,
    rescues: filteredRescues,
  };
}

export type EventFilters = ReturnType<typeof useEventFilters>;
