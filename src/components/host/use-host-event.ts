"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/components/auth-provider";
import { getEvent, listMyHostedEvents, subscribeToCampus } from "@/lib/db";
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

async function canManage(
  event: CampusEvent,
  userId: string,
  managed: { current: string | null },
): Promise<boolean> {
  const key = `${userId}:${event.id}`;
  if (event.createdBy === userId || managed.current === key) {
    managed.current = key;
    return true;
  }
  // Only a club event can have other organizers.
  if (!event.clubId) return false;
  // Includes the events of every club the user organizes.
  const hosted = await listMyHostedEvents();
  if (!hosted.some((hostedEvent) => hostedEvent.id === event.id)) return false;
  managed.current = key;
  return true;
}

// Loads one event for its host and keeps its live counters fresh.
// The creator and any organizer of the event's club can manage it.
// Everyone else gets "not_host" and no event data.
export function useHostEvent(id: string): HostEvent {
  const user = useUser();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>({ status: "loading", event: null, error: null });
  const [version, setVersion] = useState(0);

  // The event this user is already known to manage, so live refreshes skip the club lookup.
  const managed = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return; // still signing in
    try {
      const event = await getEvent(id);
      if (!event) setState({ status: "not_found", event: null, error: null });
      else if (await canManage(event, userId, managed)) setState({ status: "ready", event, error: null });
      else setState({ status: "not_host", event: null, error: null });
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
