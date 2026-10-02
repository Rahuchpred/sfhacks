// Data for the alerts that campus safety staff pin on the map. Kept apart from db.ts.
// The table is newer than database.types.ts, so the client is cast here.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export const ALERT_CATEGORIES = [
  { id: "police", label: "Police activity" },
  { id: "medical", label: "Medical" },
  { id: "fire", label: "Fire or smoke" },
  { id: "hazard", label: "Hazard" },
  { id: "closure", label: "Area closed" },
  { id: "other", label: "Other" },
] as const;

export type AlertCategory = (typeof ALERT_CATEGORIES)[number]["id"];

// How long an alert stays on the map, in hours.
export const ALERT_DURATIONS = [1, 4, 24] as const;
export type AlertDuration = (typeof ALERT_DURATIONS)[number];

export const ALERT_RADIUS = { min: 25, max: 500 } as const;

// Alerts are for the campus only. The database checks the same box.
export const ALERT_BOUNDS = { south: 37.717, north: 37.729, west: -122.488, east: -122.472 } as const;

export type SafetyAlert = {
  id: string;
  title: string;
  details: string | null;
  category: AlertCategory;
  lat: number;
  lng: number;
  radiusM: number;
  occurredAt: string;
  expiresAt: string;
  createdAt: string;
  clearedAt: string | null;
};

export type NewSafetyAlert = {
  title: string;
  details: string | null;
  category: AlertCategory;
  lat: number;
  lng: number;
  radiusM: number;
  occurredAt: string;
  hours: AlertDuration;
};

type AlertRow = {
  id: string;
  title: string;
  details: string | null;
  category: AlertCategory;
  lat: number;
  lng: number;
  radius_m: number;
  occurred_at: string;
  expires_at: string;
  created_at: string;
  cleared_at: string | null;
};

// The officer who posted is never read: the public sees the role, not the person.
const COLUMNS =
  "id, title, details, category, lat, lng, radius_m, occurred_at, expires_at, created_at, cleared_at";

const db = supabase as unknown as SupabaseClient;

function toAlert(row: AlertRow): SafetyAlert {
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    radiusM: row.radius_m,
    occurredAt: row.occurred_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    clearedAt: row.cleared_at,
  };
}

export function alertCategoryLabel(category: AlertCategory): string {
  return ALERT_CATEGORIES.find((item) => item.id === category)?.label ?? "Other";
}

export function isAlertActive(alert: SafetyAlert, now: number): boolean {
  return alert.clearedAt === null && Date.parse(alert.expiresAt) > now;
}

export function inAlertBounds(lat: number, lng: number): boolean {
  return (
    lat >= ALERT_BOUNDS.south &&
    lat <= ALERT_BOUNDS.north &&
    lng >= ALERT_BOUNDS.west &&
    lng <= ALERT_BOUNDS.east
  );
}

// Alerts on the map right now, newest first. Open to everyone, guests included.
export async function listActiveAlerts(): Promise<SafetyAlert[]> {
  const { data, error } = await db
    .from("safety_alerts")
    .select(COLUMNS)
    .is("cleared_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as AlertRow[]).map(toAlert);
}

// Alerts that were cleared or ran out in the last two days. Empty for anyone but safety staff.
export async function listEndedAlerts(): Promise<SafetyAlert[]> {
  const now = Date.now();
  const { data, error } = await db
    .from("safety_alerts")
    .select(COLUMNS)
    .gt("expires_at", new Date(now - 48 * 3_600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as AlertRow[])
    .map(toAlert)
    .filter((alert) => !isAlertActive(alert, now))
    .slice(0, 10);
}

// Safety staff only. The database refuses every other role.
export async function postAlert(input: NewSafetyAlert): Promise<SafetyAlert> {
  const { data, error } = await db
    .from("safety_alerts")
    .insert({
      title: input.title.trim(),
      details: input.details?.trim() || null,
      category: input.category,
      lat: input.lat,
      lng: input.lng,
      radius_m: Math.round(input.radiusM),
      occurred_at: input.occurredAt,
      expires_at: new Date(Date.now() + input.hours * 3_600_000).toISOString(),
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toAlert(data as AlertRow);
}

// "All clear": ends an alert before it runs out. Safety staff only.
export async function clearAlert(id: string): Promise<SafetyAlert> {
  const { data, error } = await db
    .from("safety_alerts")
    .update({ cleared_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toAlert(data as AlertRow);
}

// Calls onChange whenever an alert is posted or cleared. A visitor cannot read a cleared
// alert, so its row change never reaches them: the database also sends a public "changed"
// message for every change, and both end up here. One channel is shared by every caller,
// because the topic has to match the one the database sends to.
const listeners = new Set<() => void>();
let channel: ReturnType<SupabaseClient["channel"]> | null = null;

export function subscribeToAlerts(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!channel) {
    const notify = () => listeners.forEach((listener) => listener());
    channel = db
      .channel("safety-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "safety_alerts" }, notify)
      .on("broadcast", { event: "changed" }, notify)
      .subscribe();
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && channel) {
      db.removeChannel(channel);
      channel = null;
    }
  };
}
