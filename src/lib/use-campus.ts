"use client";

import { useEffect, useState } from "react";
import {
  listBuildings,
  listOpenRescues,
  listUpcomingEvents,
  subscribeToCampus,
} from "@/lib/db";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";

type Campus = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
  loading: boolean;
  error: string | null;
};

// Live campus data: loads once, then reloads whenever events or rescues change.
export function useCampus(): Campus {
  const [campus, setCampus] = useState<Campus>({
    buildings: [],
    events: [],
    rescues: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [buildings, events, rescues] = await Promise.all([
          listBuildings(),
          listUpcomingEvents(),
          listOpenRescues(),
        ]);
        if (!cancelled) setCampus({ buildings, events, rescues, loading: false, error: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not load campus data.";
        if (!cancelled) setCampus((current) => ({ ...current, loading: false, error: message }));
      }
    }

    load();
    const unsubscribe = subscribeToCampus(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return campus;
}
