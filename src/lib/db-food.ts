// Data for managing food posts: close, reopen, remove, and the notices students get
// when a hold is cancelled. Kept apart from db.ts, like db-planner.ts.
import { supabase } from "@/lib/supabase/client";
import { toEvent, toRescue } from "@/lib/db";
import type { CampusEvent, FoodRescue } from "@/lib/types";

// The tables and functions below are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// A food post as its club sees it.
export type FoodPost = FoodRescue & {
  createdAt: string;
  closedAt: string | null; // set while the club has closed it by hand
};

// A post on the "Leftover food" page, with its event and live hold counts.
export type HostFoodPost = FoodPost & {
  eventTitle: string | null;
  held: number; // holds waiting for pickup
  pickedUp: number;
};

export type FoodPostState = "open" | "claimed" | "closed" | "expired";

export const FOOD_POST_LABELS: Record<FoodPostState, string> = {
  open: "Open",
  claimed: "All claimed",
  closed: "Closed by you",
  expired: "Expired",
};

export function foodPostState(post: FoodPost, now: number): FoodPostState {
  if (post.closedAt) return "closed";
  if (post.status === "expired" || Date.parse(post.safeUntil) <= now) return "expired";
  return post.status === "gone" ? "claimed" : "open";
}

// A closed post can go back on the list while its food is still safe to eat.
export function canReopen(post: FoodPost, now: number): boolean {
  return post.closedAt !== null && post.portionsLeft > 0 && Date.parse(post.safeUntil) > now;
}

// "Food is gone" only makes sense for a post students can still see or hold.
export function canClose(post: FoodPost, now: number): boolean {
  const state = foodPostState(post, now);
  return state === "open" || state === "claimed";
}

type PostRow = Parameters<typeof toRescue>[0] & { created_at: string; closed_at: string | null };

function toPost(row: PostRow): FoodPost {
  return { ...toRescue(row), createdAt: row.created_at, closedAt: row.closed_at ?? null };
}

// Every food post the signed-in user may run, newest first.
export async function listHostFoodPosts(): Promise<HostFoodPost[]> {
  const { data, error } = await db.rpc("host_food_posts");
  if (error) throw error;
  return (data as (PostRow & { event_title: string | null; held: number; picked_up: number })[]).map(
    (row) => ({
      ...toPost(row),
      eventTitle: row.event_title,
      held: row.held,
      pickedUp: row.picked_up,
    }),
  );
}

// Events the signed-in user can post food from: live, or over for less than 12 hours.
export async function listHostFoodEvents(): Promise<CampusEvent[]> {
  const { data, error } = await db.rpc("host_food_events");
  if (error) throw error;
  return (data as Parameters<typeof toEvent>[0][]).map(toEvent);
}

// Food posts of one event, any state, newest first.
export async function listEventFoodPosts(eventId: string): Promise<FoodPost[]> {
  const { data, error } = await supabase
    .from("food_rescues")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as PostRow[]).map(toPost);
}

export type FoodActionResult = {
  ok: boolean;
  reason: "not_found" | "not_host" | "expired" | null;
  cancelled: number; // portions that were on hold and are now cancelled
};

async function foodAction(fn: string, rescueId: string): Promise<FoodActionResult> {
  const { data, error } = await db.rpc(fn, { p_rescue_id: rescueId }).single();
  if (error) throw error;
  return { ok: data.ok, reason: data.reason ?? null, cancelled: data.cancelled ?? 0 };
}

// "Food is gone": the post leaves the Free food page and open holds are cancelled.
export function closeRescue(rescueId: string): Promise<FoodActionResult> {
  return foodAction("close_rescue", rescueId);
}

// Puts a closed post back on the Free food page. Fails with "expired" past its safe-until time.
export function reopenRescue(rescueId: string): Promise<FoodActionResult> {
  return foodAction("reopen_rescue", rescueId);
}

// Deletes a post made by mistake. Students holding a portion get a notice.
export function removeRescue(rescueId: string): Promise<FoodActionResult> {
  return foodAction("remove_rescue", rescueId);
}

// Tells a student that a portion they held is no longer available.
export type ClaimNotice = {
  id: string;
  rescueId: string;
  foodName: string;
  reason: "closed" | "removed";
  portions: number;
  claimIds: string[]; // the holds this notice replaces
  createdAt: string;
};

// The signed-in student's notices, newest first.
export async function listMyClaimNotices(): Promise<ClaimNotice[]> {
  const { data, error } = await db
    .from("claim_notices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (
    data as {
      id: string;
      rescue_id: string;
      food_name: string;
      reason: ClaimNotice["reason"];
      portions: number;
      claim_ids: string[];
      created_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    rescueId: row.rescue_id,
    foodName: row.food_name,
    reason: row.reason,
    portions: row.portions,
    claimIds: row.claim_ids,
    createdAt: row.created_at,
  }));
}

export async function dismissClaimNotice(id: string): Promise<void> {
  const { error } = await db.from("claim_notices").delete().eq("id", id);
  if (error) throw error;
}
