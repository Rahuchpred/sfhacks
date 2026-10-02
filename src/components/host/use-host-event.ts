"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/auth-provider";
import { getEvent, subscribeToCampus } from "@/lib/db";
import type { CampusEvent } from "@/lib/types";

export type HostEventStatus = "loading" | "ready" | "not_found" | "not_host" | "error";

type HostEvent = {
  status: HostEventStatus;
  event: CampusEvent | null; // set only when status is "ready"
  error: string | null;
  refresh: () => Promise<void>;
  version: number; // bumps on every live change, so lists that depend on the event can refetch
};

type State = Pick<HostEvent, "status" | "event" | "error">;

// Loads one event for its host and keeps its live counters fresh.
// Anyone who did not create the event gets "not_host" and no event data.
export function useHostEvent(id: string): HostEvent {
  const user = useUser();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>({ status: "loading", event: null, error: null });
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) return; // still signing in
    try {
      const event = await getEvent(id);
      if (!event) setState({ status: "not_found", event: null, error: null });
      else if (event.createdBy !== userId) setState({ status: "not_host", event: null, error: null });
      else setState({ status: "ready", event, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load this event.";
      // Keep showing the last good event if a background refresh fails.
      setState((current) =>
        current.status === "ready" ? current : { status: "error", event: null, error: message },
      );
    }
  }, [id, userId]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!cancelled) refresh();
    };
    load();
    const unsubscribe = subscribeToCampus(() => {
      if (cancelled) return;
      setVersion((current) => current + 1);
      refresh();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refresh]);

  return { ...state, refresh, version };
}
