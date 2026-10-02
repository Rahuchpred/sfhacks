"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/components/auth-provider";
import { getEvent, listMyClaims, releaseExpiredClaims, toRescue } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import type { CampusEvent, FoodRescue, MyClaim } from "@/lib/types";

// The student's pickups come from the database (listMyClaims), never from
// browser storage. The database deletes a hold when it expires, so a hold this
// page has already seen is kept in memory and shown as expired until dismissed.

export type Pickup = MyClaim & {
  released: boolean; // the database already put this portion back on the list
};

export type PickupState = "holding" | "picked_up" | "expired";

export function pickupState(pickup: Pickup, now: number): PickupState {
  if (pickup.pickedUpAt) return "picked_up";
  if (pickup.released || Date.parse(pickup.expiresAt) <= now) return "expired";
  return "holding";
}

const POLL_MS = 10_000;
// Anonymous sign-in normally lands in under a second. Past this, stop waiting.
const AUTH_WAIT_MS = 5_000;

function merge(previous: Pickup[], fresh: MyClaim[]): Pickup[] {
  const freshIds = new Set(fresh.map((claim) => claim.id));
  // A hold that vanished without a pickup was released by the database.
  const released = previous
    .filter((pickup) => !freshIds.has(pickup.id) && !pickup.pickedUpAt)
    .map((pickup) => ({ ...pickup, released: true }));
  return [...fresh.map((claim) => ({ ...claim, released: false })), ...released].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

// `rescueKey` changes whenever the live rescue list changes, which refreshes
// the claims too.
export function useClaims(rescueKey: string): {
  pickups: Pickup[];
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  dismiss(ids: string[]): void;
} {
  const uid = useUser()?.id ?? null;
  const [state, setState] = useState<{ uid: string | null; pickups: Pickup[] }>({
    uid: null,
    pickups: [],
  });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const releasedOnLoad = useRef<string | null>(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!uid) return;
    const request = ++latest.current;
    try {
      const fresh = await listMyClaims();
      if (request !== latest.current) return;
      setState((current) => ({
        uid,
        pickups: merge(current.uid === uid ? current.pickups : [], fresh),
      }));
      setError(null);
    } catch (cause) {
      if (request !== latest.current) return;
      setError(cause instanceof Error ? cause.message : "Could not load your pickups.");
    } finally {
      setLoadedFor(uid);
    }
  }, [uid]);

  // Puts expired holds back on the list, then reloads.
  const release = useCallback(async () => {
    try {
      await releaseExpiredClaims();
    } catch {
      // The next claim or page load releases them instead.
    }
    await load();
  }, [load]);

  // On page load: read the claims first, so a hold that ran out while the
  // student was away is still seen once, then release expired holds.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled || releasedOnLoad.current === uid) return;
      releasedOnLoad.current = uid;
      await release();
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, rescueKey, load, release]);

  useEffect(() => {
    if (uid) return;
    const id = window.setTimeout(() => setGaveUp(true), AUTH_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [uid]);

  const pickups = useMemo(
    () => (state.uid === uid ? state.pickups.filter((pickup) => !dismissed.has(pickup.id)) : []),
    [state, uid, dismissed],
  );

  // While a hold is open: release it the moment it runs out, and poll so a
  // pickup confirmed by the organizer shows up without a refresh.
  const open = state.pickups.filter((pickup) => !pickup.pickedUpAt && !pickup.released);
  const nextExpiry = open.length > 0 ? Math.min(...open.map((p) => Date.parse(p.expiresAt))) : null;

  useEffect(() => {
    if (nextExpiry === null) return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (nextExpiry <= Date.now()) release();
      else load();
    };
    const poll = window.setInterval(tick, POLL_MS);
    const atExpiry = window.setTimeout(release, Math.max(0, nextExpiry - Date.now()) + 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(atExpiry);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [nextExpiry, load, release]);

  const dismiss = useCallback((ids: string[]) => {
    setDismissed((current) => new Set([...current, ...ids]));
  }, []);

  return {
    pickups,
    loading: uid ? loadedFor !== uid : !gaveUp,
    error,
    refresh: load,
    dismiss,
  };
}

// Rescues by id for the student's pickups. The live list only has open
// rescues, so one that is fully claimed or past its time is fetched once.
export function useRescueLookup(live: FoodRescue[], ids: string[]): Map<string, FoodRescue> {
  const [fetched, setFetched] = useState<Map<string, FoodRescue>>(new Map());
  const asked = useRef(new Set<string>());

  // Every rescue seen on the live list is remembered for this visit.
  const seen = useRef(new Map<string, FoodRescue>());
  useEffect(() => {
    for (const rescue of live) seen.current.set(rescue.id, rescue);
  }, [live]);

  const liveIds = useMemo(() => new Set(live.map((rescue) => rescue.id)), [live]);
  const missingKey = ids
    .filter((id) => !liveIds.has(id))
    .sort()
    .join(",");

  useEffect(() => {
    const missing = missingKey.split(",").filter((id) => id && !asked.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => asked.current.add(id));

    supabase
      .from("food_rescues")
      .select("*")
      .in("id", missing)
      .then(({ data }) => {
        if (!data) {
          missing.forEach((id) => asked.current.delete(id));
          return;
        }
        setFetched((current) => {
          const next = new Map(current);
          for (const row of data) next.set(row.id, toRescue(row));
          // Deleted posts fall back to what the live list last showed.
          for (const id of missing) {
            const last = seen.current.get(id);
            if (!next.has(id) && last) next.set(id, last);
          }
          return next;
        });
      });
  }, [missingKey]);

  return useMemo(() => {
    const lookup = new Map(fetched);
    for (const rescue of live) lookup.set(rescue.id, rescue);
    return lookup;
  }, [fetched, live]);
}

// Events by id for the "From ..." line. Leftover food usually comes from an
// event that has ended, which the upcoming list no longer includes.
export function useEventLookup(
  upcoming: CampusEvent[],
  ids: (string | null)[],
): Map<string, CampusEvent> {
  const [fetched, setFetched] = useState<Map<string, CampusEvent>>(new Map());
  const asked = useRef(new Set<string>());

  const upcomingIds = useMemo(() => new Set(upcoming.map((event) => event.id)), [upcoming]);
  const missingKey = [...new Set(ids)]
    .filter((id): id is string => id !== null && !upcomingIds.has(id))
    .sort()
    .join(",");

  useEffect(() => {
    const missing = missingKey.split(",").filter((id) => id && !asked.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => asked.current.add(id));

    Promise.all(missing.map((id) => getEvent(id).catch(() => null))).then((events) => {
      setFetched((current) => {
        const next = new Map(current);
        for (const event of events) if (event) next.set(event.id, event);
        return next;
      });
    });
  }, [missingKey]);

  return useMemo(() => {
    const lookup = new Map(fetched);
    for (const event of upcoming) lookup.set(event.id, event);
    return lookup;
  }, [fetched, upcoming]);
}
