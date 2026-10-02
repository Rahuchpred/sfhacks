import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Building, CampusEvent, FoodRescue } from "@shared/types";
import { listBuildings, listOpenRescues, listUpcomingEvents, subscribeToCampus } from "@/lib/db";

type Campus = {
  status: "loading" | "error" | "ready";
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
  refresh: () => void;
};

const CampusContext = createContext<Campus | null>(null);

export function CampusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Campus["status"]>("loading");
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [rescues, setRescues] = useState<FoodRescue[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listBuildings(), listUpcomingEvents(), listOpenRescues()])
      .then(([nextBuildings, nextEvents, nextRescues]) => {
        if (cancelled) return;
        setBuildings(nextBuildings);
        setEvents(nextEvents);
        setRescues(nextRescues);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus((current) => (current === "ready" ? current : "error"));
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => subscribeToCampus(refresh), [refresh]);

  const value = useMemo(
    () => ({ status, buildings, events, rescues, refresh }),
    [status, buildings, events, rescues, refresh],
  );

  return <CampusContext.Provider value={value}>{children}</CampusContext.Provider>;
}

export function useCampus(): Campus {
  const value = useContext(CampusContext);
  if (!value) throw new Error("useCampus must be used inside CampusProvider");
  return value;
}

export function buildingById(buildings: Building[], id: string): Building | undefined {
  return buildings.find((building) => building.id === id);
}
