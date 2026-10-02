// The only place that talks to Supabase tables. Maps snake_case rows to app types.
import { supabase, UPLOADS_BUCKET } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import type {
  Building,
  CampusEvent,
  CheckInResult,
  ClaimResult,
  EventUpdate,
  FoodRescue,
  Guest,
  NewCampusEvent,
  NewFoodRescue,
  Profile,
  ProfileUpdate,
  Ticket,
  TicketWithEvent,
} from "@/lib/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type RescueRow = Database["public"]["Tables"]["food_rescues"]["Row"];
type RsvpRow = Database["public"]["Tables"]["rsvps"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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
    rsvpCount: row.rsvp_count,
    checkedInCount: row.checked_in_count,
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

// Events: single event, hosting, editing

export async function getEvent(id: string): Promise<CampusEvent | null> {
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toEvent(data) : null;
}

// Events the signed-in user created, newest first, including past ones.
export async function listMyHostedEvents(): Promise<CampusEvent[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("created_by", auth.user.id)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return data.map(toEvent);
}

export async function updateEvent(id: string, changes: EventUpdate): Promise<CampusEvent> {
  const { data, error } = await supabase
    .from("events")
    .update({
      title: changes.title,
      description: changes.description,
      club_name: changes.clubName,
      building_id: changes.buildingId,
      room: changes.room,
      starts_at: changes.startsAt,
      ends_at: changes.endsAt,
      tags: changes.tags,
      has_food: changes.hasFood,
      flyer_url: changes.flyerUrl,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toEvent(data);
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

// RSVPs, tickets and check-in

function toTicket(row: RsvpRow): Ticket {
  return {
    id: row.id,
    eventId: row.event_id,
    code: row.code,
    createdAt: row.created_at,
    checkedInAt: row.checked_in_at,
  };
}

// Registers the signed-in user. Safe to call twice: returns the existing ticket.
export async function rsvpEvent(eventId: string): Promise<Ticket> {
  const { data, error } = await supabase.rpc("rsvp_event", { p_event_id: eventId });
  if (error) throw error;
  return toTicket(data);
}

export async function cancelRsvp(eventId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("cancel_rsvp", { p_event_id: eventId });
  if (error) throw error;
  return data;
}

export async function getMyTicket(eventId: string): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from("rsvps")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data ? toTicket(data) : null;
}

// Every ticket the signed-in user holds, with its event, soonest first.
export async function listMyTickets(): Promise<TicketWithEvent[]> {
  const { data, error } = await supabase.from("rsvps").select("*, events(*)");
  if (error) throw error;
  return data
    .filter((row) => row.events)
    .map((row) => ({ ...toTicket(row), event: toEvent(row.events) }))
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
}

// Host only: checks a guest in by ticket code (scanned or typed).
export async function checkIn(code: string): Promise<CheckInResult> {
  const { data, error } = await supabase.rpc("check_in", { p_code: code }).single();
  if (error) throw error;
  return {
    ok: data.ok,
    reason: data.reason as CheckInResult["reason"],
    guestName: data.guest_name,
    eventId: data.event_id,
    checkedInAt: data.checked_in_at,
  };
}

// Host only: returns an empty list for anyone who did not create the event.
export async function listGuests(eventId: string): Promise<Guest[]> {
  const { data, error } = await supabase.rpc("event_guests", { p_event_id: eventId });
  if (error) throw error;
  return data.map((row) => ({
    rsvpId: row.rsvp_id,
    name: row.guest_name,
    sfsuVerified: row.sfsu_verified,
    createdAt: row.created_at,
    checkedInAt: row.checked_in_at,
  }));
}

// Profiles

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    sfsuVerified: row.sfsu_verified,
    major: row.major,
    gradYear: row.grad_year,
    bio: row.bio,
    linkedinUrl: row.linkedin_url,
    githubUrl: row.github_url,
    resumeUrl: row.resume_url,
    aiSummary: row.ai_summary,
    recruiterVisible: row.recruiter_visible,
  };
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? toProfile(data) : null;
}

// Creates the profile on first save.
export async function saveMyProfile(changes: ProfileUpdate): Promise<Profile> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: auth.user.id,
      full_name: changes.fullName,
      major: changes.major,
      grad_year: changes.gradYear,
      bio: changes.bio,
      linkedin_url: changes.linkedinUrl,
      github_url: changes.githubUrl,
      resume_url: changes.resumeUrl,
      ai_summary: changes.aiSummary,
      recruiter_visible: changes.recruiterVisible,
    })
    .select()
    .single();
  if (error) throw error;
  return toProfile(data);
}

// Only students who opted in. Row level security enforces this in the database.
export async function listRecruiterVisibleProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("recruiter_visible", true)
    .order("full_name");
  if (error) throw error;
  return data.map(toProfile);
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
