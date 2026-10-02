// The only place that talks to Supabase tables. Maps snake_case rows to app types.
import { supabase, UPLOADS_BUCKET } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import type {
  Building,
  CampusEvent,
  ClaimResult,
  FoodRescue,
  NewCampusEvent,
  NewFoodRescue,
} from "@/lib/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type RescueRow = Database["public"]["Tables"]["food_rescues"]["Row"];

export function toEvent(row: EventRow): CampusEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    clubName: row.club_name,
    buildingId: row.building_id,
    room: row.room,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    tags: row.tags,
    hasFood: row.has_food,
    flyerUrl: row.flyer_url,
    source: row.source as CampusEvent["source"],
    createdBy: row.created_by,
  };
}

export function toRescue(row: RescueRow): FoodRescue {
  return {
    id: row.id,
    eventId: row.event_id,
    buildingId: row.building_id,
    room: row.room,
    photoUrl: row.photo_url,
    items: row.items,
    portions: row.portions,
    portionsLeft: row.portions_left,
    maxPerPerson: row.max_per_person,
    dietary: row.dietary,
    safeUntil: row.safe_until,
    status: row.status as FoodRescue["status"],
    createdBy: row.created_by,
  };
}

export async function listBuildings(): Promise<Building[]> {
  const { data, error } = await supabase.from("buildings").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function listUpcomingEvents(): Promise<CampusEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;
  return data.map(toEvent);
}

export async function listOpenRescues(): Promise<FoodRescue[]> {
  const { data, error } = await supabase
    .from("food_rescues")
    .select("*")
    .eq("status", "open")
    .gte("safe_until", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toRescue);
}

export async function createEvent(event: NewCampusEvent): Promise<CampusEvent> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: event.title,
      description: event.description,
      club_name: event.clubName,
      building_id: event.buildingId,
      room: event.room,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      tags: event.tags,
      has_food: event.hasFood,
      flyer_url: event.flyerUrl,
      source: event.source,
    })
    .select()
    .single();
  if (error) throw error;
  return toEvent(data);
}

export async function createRescue(rescue: NewFoodRescue): Promise<FoodRescue> {
  const { data, error } = await supabase
    .from("food_rescues")
    .insert({
      event_id: rescue.eventId,
      building_id: rescue.buildingId,
      room: rescue.room,
      photo_url: rescue.photoUrl,
      items: rescue.items,
      portions: rescue.portions,
      portions_left: rescue.portions,
      max_per_person: rescue.maxPerPerson,
      dietary: rescue.dietary,
      safe_until: rescue.safeUntil,
    })
    .select()
    .single();
  if (error) throw error;
  return toRescue(data);
}

export async function claimPortion(rescueId: string): Promise<ClaimResult> {
  const { data, error } = await supabase
    .rpc("claim_portion", { p_rescue_id: rescueId })
    .single();
  if (error) throw error;
  return {
    ok: data.ok,
    portionsLeft: data.portions_left,
    reason: data.reason as ClaimResult["reason"],
  };
}

// Rescue ids the signed-in user has claimed. An id repeats once per portion held.
export async function listMyClaims(): Promise<string[]> {
  const { data, error } = await supabase.from("claims").select("rescue_id");
  if (error) throw error;
  return data.map((row) => row.rescue_id);
}

export async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Calls onChange whenever events or rescues change, so lists and the map stay live.
export function subscribeToCampus(onChange: () => void): () => void {
  const channel = supabase
    .channel("campus")
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "food_rescues" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
