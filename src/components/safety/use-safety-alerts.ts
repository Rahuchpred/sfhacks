"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAlertActive, listActiveAlerts, subscribeToAlerts, type SafetyAlert } from "@/lib/db-safety";

type State = { alerts: SafetyAlert[]; loading: boolean; error: string | null };

function messageOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Could not load alerts.";
}

// The alerts on the map right now, kept live: new and cleared ones arrive without a
// reload, and each one drops out by itself the moment it runs out.
export function useSafetyAlerts() {
  const [state, setState] = useState<State>({ alerts: [], loading: true, error: null });
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
    try {
      const alerts = await listActiveAlerts();
      setNow(Date.now());
      setState({ alerts, loading: false, error: null });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: messageOf(error) }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!cancelled) reload();
    };
    load();
    const unsubscribe = subscribeToAlerts(load);
    // A tab that slept may have missed a message.
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  const alerts = useMemo(
    () => state.alerts.filter((alert) => isAlertActive(alert, now)),
    [state.alerts, now],
  );

  // Wake up when the next alert runs out.
  useEffect(() => {
    if (alerts.length === 0) return;
    const next = Math.min(...alerts.map((alert) => Date.parse(alert.expiresAt)));
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(next - Date.now(), 0) + 250);
    return () => window.clearTimeout(timer);
  }, [alerts]);

  return { alerts, now, loading: state.loading, error: state.error, reload };
}
