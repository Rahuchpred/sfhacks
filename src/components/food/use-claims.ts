"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { FoodRescue } from "@/lib/types";

// Stub until db.ts has listMyClaims() (see docs/plans/requests-food.md).
// Claims this browser made are remembered in localStorage.

export type HeldClaim = Pick<
  FoodRescue,
  "id" | "items" | "buildingId" | "room" | "safeUntil" | "photoUrl"
>;

const STORAGE_KEY = "gator-radar:claims";
const KEEP_AFTER_MS = 24 * 60 * 60 * 1000;
const EMPTY: HeldClaim[] = [];

const listeners = new Set<() => void>();

// useSyncExternalStore needs the same array back until the data changes,
// so the parsed list is cached against the raw string it came from.
let cachedRaw: string | null = null;
let cachedClaims: HeldClaim[] = EMPTY;
// Used instead of localStorage when it is blocked (private mode, full quota).
let memoryRaw: string | null = null;

function isHeldClaim(value: unknown): value is HeldClaim {
  if (typeof value !== "object" || value === null) return false;
  const claim = value as Record<string, unknown>;
  return (
    typeof claim.id === "string" &&
    typeof claim.items === "string" &&
    typeof claim.buildingId === "string" &&
    (typeof claim.room === "string" || claim.room === null) &&
    typeof claim.safeUntil === "string" &&
    typeof claim.photoUrl === "string"
  );
}

function parse(raw: string | null): HeldClaim[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;
    const cutoff = Date.now() - KEEP_AFTER_MS;
    const claims = value.filter(
      (claim): claim is HeldClaim => isHeldClaim(claim) && Date.parse(claim.safeUntil) > cutoff,
    );
    return claims.length > 0 ? claims : EMPTY;
  } catch {
    return EMPTY;
  }
}

function readRaw(): string | null {
  if (memoryRaw !== null) return memoryRaw;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): HeldClaim[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedClaims = parse(raw);
  }
  return cachedClaims;
}

function getServerSnapshot(): HeldClaim[] {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  // The storage event fires in other tabs, which keeps them in sync.
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key === STORAGE_KEY) onChange();
  }
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function holdClaim(rescue: FoodRescue): void {
  const current = getSnapshot();
  if (current.some((claim) => claim.id === rescue.id)) return;

  const claim: HeldClaim = {
    id: rescue.id,
    items: rescue.items,
    buildingId: rescue.buildingId,
    room: rescue.room,
    safeUntil: rescue.safeUntil,
    photoUrl: rescue.photoUrl,
  };
  const raw = JSON.stringify([...current, claim]);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    memoryRaw = raw;
  }
  listeners.forEach((listener) => listener());
}

export function useClaims(): {
  held: HeldClaim[];
  isHeld(id: string): boolean;
  hold(rescue: FoodRescue): void;
} {
  const held = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isHeld = useCallback((id: string) => held.some((claim) => claim.id === id), [held]);
  return { held, isHeld, hold: holdClaim };
}
