import type {
  Building,
  CampusEvent,
  CheckInResult,
  ClaimResult,
  Club,
  ClubLevel,
  FoodRescue,
  HelpRequest,
  MyClaim,
  MyClub,
  Profile,
  ProfileUpdate,
  Role,
  Ticket,
  TicketWithEvent,
} from "@shared/types";
import { supabase } from "@/lib/supabase";

type EventRow = {
  id: string;
  title: string;
  description: string;
  club_name: string;
  building_id: string;
  room: string | null;
  starts_at: string;
  ends_at: string;
  tags: string[] | null;
  has_food: boolean;
  flyer_url: string | null;
  source: string;
  created_by: string | null;
  rsvp_count: number;
  checked_in_count: number;
  club_id: string | null;
  food_items: string[] | null;
  cost: number | null;
};

type RescueRow = {
  id: string;
  event_id: string | null;
  building_id: string;
  room: string | null;
  photo_url: string;
  items: string;
  portions: number;
  portions_left: number;
  max_per_person: number;
  dietary: string[] | null;
  safe_until: string;
  status: string;
  created_by: string | null;
};

type ProfileRow = {
  id: string;
  role?: string | null;
  is_demo?: boolean;
  department?: string | null;
  company?: string | null;
  full_name: string;
  email: string | null;
  sfsu_verified: boolean;
  major: string;
  grad_year: number | null;
  bio: string;
  linkedin_url: string | null;
  github_url: string | null;
  resume_url: string | null;
  ai_summary: string | null;
  recruiter_visible: boolean;
};

function toEvent(row: EventRow): CampusEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    clubName: row.club_name,
    buildingId: row.building_id,
    room: row.room,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    tags: row.tags ?? [],
    hasFood: row.has_food,
    flyerUrl: row.flyer_url,
    source: row.source as CampusEvent["source"],
    createdBy: row.created_by,
    rsvpCount: row.rsvp_count,
    checkedInCount: row.checked_in_count,
    clubId: row.club_id,
    foodItems: row.food_items ?? [],
    cost: row.cost,
  };
}

function toRescue(row: RescueRow): FoodRescue {
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
    dietary: row.dietary ?? [],
    safeUntil: row.safe_until,
    status: row.status as FoodRescue["status"],
    createdBy: row.created_by,
  };
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    role: (row.role ?? null) as Role | null,
    isDemo: row.is_demo ?? false,
    department: row.department ?? "",
    company: row.company ?? "",
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

function toTicket(row: {
  id: string;
  event_id: string;
  code: string;
  created_at: string;
  checked_in_at: string | null;
}): Ticket {
  return {
    id: row.id,
    eventId: row.event_id,
    code: row.code,
    createdAt: row.created_at,
    checkedInAt: row.checked_in_at,
  };
}

export async function listBuildings(): Promise<Building[]> {
  const { data, error } = await supabase.from("buildings").select("*").order("name");
  if (error) throw error;
  return data as Building[];
}

export async function listUpcomingEvents(): Promise<CampusEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;
  return (data as EventRow[]).map(toEvent);
}

export async function getEvent(id: string): Promise<CampusEvent | null> {
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toEvent(data as EventRow) : null;
}

export async function listOpenRescues(): Promise<FoodRescue[]> {
  const { data, error } = await supabase
    .from("food_rescues")
    .select("*")
    .eq("status", "open")
    .gte("safe_until", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RescueRow[]).map(toRescue);
}

export async function listRescuesByIds(ids: string[]): Promise<FoodRescue[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("food_rescues").select("*").in("id", ids);
  if (error) throw error;
  return (data as RescueRow[]).map(toRescue);
}

export async function claimPortion(rescueId: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("claim_portion", { p_rescue_id: rescueId }).single();
  if (error) throw error;
  const row = data as {
    ok: boolean;
    portions_left: number;
    reason: ClaimResult["reason"];
    claim_code: string | null;
    expires_at: string | null;
  };
  return {
    ok: row.ok,
    portionsLeft: row.portions_left,
    reason: row.reason,
    claimCode: row.claim_code,
    expiresAt: row.expires_at,
  };
}

export async function listMyClaims(): Promise<MyClaim[]> {
  const { data, error } = await supabase.from("claims").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as {
    id: string;
    rescue_id: string;
    code: string;
    created_at: string;
    expires_at: string;
    picked_up_at: string | null;
  }[]).map((row) => ({
    id: row.id,
    rescueId: row.rescue_id,
    code: row.code,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    pickedUpAt: row.picked_up_at,
  }));
}

export async function releaseExpiredClaims(): Promise<void> {
  const { error } = await supabase.rpc("release_expired_claims");
  if (error) throw error;
}

export async function rsvpEvent(eventId: string): Promise<Ticket> {
  const { data, error } = await supabase.rpc("rsvp_event", { p_event_id: eventId });
  if (error) throw error;
  return toTicket(data as Parameters<typeof toTicket>[0]);
}

export async function cancelRsvp(eventId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("cancel_rsvp", { p_event_id: eventId });
  if (error) throw error;
  return Boolean(data);
}

export async function getMyTicket(eventId: string): Promise<Ticket | null> {
  const { data, error } = await supabase.from("rsvps").select("*").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  return data ? toTicket(data as Parameters<typeof toTicket>[0]) : null;
}

export async function listMyTickets(): Promise<TicketWithEvent[]> {
  const { data, error } = await supabase.from("rsvps").select("*, events(*)");
  if (error) throw error;
  return (data as ({ events: EventRow | null } & Parameters<typeof toTicket>[0])[])
    .filter((row) => row.events)
    .map((row) => ({ ...toTicket(row), event: toEvent(row.events as EventRow) }))
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
}

export async function checkIn(code: string): Promise<CheckInResult> {
  const { data, error } = await supabase.rpc("check_in", { p_code: code.trim() }).single();
  if (error) throw error;
  const row = data as {
    ok: boolean;
    reason: CheckInResult["reason"];
    guest_name: string | null;
    event_id: string | null;
    checked_in_at: string | null;
  };
  return {
    ok: row.ok,
    reason: row.reason,
    guestName: row.guest_name,
    eventId: row.event_id,
    checkedInAt: row.checked_in_at,
  };
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  if (error) throw error;
  return data ? toProfile(data as ProfileRow) : null;
}

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
      department: changes.department,
      company: changes.company,
      recruiter_visible: changes.recruiterVisible,
    })
    .select()
    .single();
  if (error) throw error;
  return toProfile(data as ProfileRow);
}

export async function setMyRole(role: Role): Promise<Profile> {
  const { data, error } = await supabase.rpc("set_my_role", { p_role: role }).single();
  if (error || !data) throw new Error(error?.message ?? "Could not set the role.");
  return toProfile(data as ProfileRow);
}

export async function listClubs(): Promise<Club[]> {
  const { data, error } = await supabase.from("clubs").select("id, name, created_by").order("name");
  if (error) throw error;
  return (data as { id: string; name: string; created_by: string }[]).map((row) => ({
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
  }));
}

export async function getClub(id: string): Promise<Club | null> {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, created_by")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const row = data as { id: string; name: string; created_by: string } | null;
  return row ? { id: row.id, name: row.name, createdBy: row.created_by } : null;
}

export async function listClubEvents(clubId: string): Promise<CampusEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("club_id", clubId)
    .gte("ends_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;
  return (data as EventRow[]).map(toEvent);
}

export async function listMyClubs(): Promise<MyClub[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("club_members")
    .select("role, clubs(id, name, created_by, club_invites(code))")
    .eq("uid", auth.user.id);
  if (error) throw error;
  return (data as unknown as {
    role: ClubLevel;
    clubs: { id: string; name: string; created_by: string; club_invites: { code: string } | null } | null;
  }[])
    .filter((row) => row.clubs)
    .map((row) => ({
      id: row.clubs!.id,
      name: row.clubs!.name,
      createdBy: row.clubs!.created_by,
      role: row.role,
      joinCode: row.clubs!.club_invites?.code ?? "",
    }));
}

export async function listOpenHelpRequests(): Promise<HelpRequest[]> {
  const { data, error } = await supabase
    .from("help_requests")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as HelpRow[]).map(toHelp);
}

export async function getHelpRequest(id: string): Promise<HelpRequest | null> {
  const { data, error } = await supabase.from("help_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toHelp(data as HelpRow) : null;
}

export async function offerHelp(requestId: string, note: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in.");
  const { error } = await supabase.from("help_offers").insert({ request_id: requestId, uid: auth.user.id, note });
  if (error) throw error;
}

export async function listSafetyNotices() {
  const { data, error } = await supabase
    .from("safety_notices")
    .select("*")
    .order("occurred_on", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as {
    id: string;
    source_url: string;
    kind: string;
    category: string;
    title: string;
    summary: string;
    area: string;
    building_id: string | null;
    show_pin: boolean;
    occurred_on: string | null;
    fetched_at: string;
  }[]).map((row) => ({
    id: row.id,
    sourceUrl: row.source_url,
    kind: row.kind,
    category: row.category,
    title: row.title,
    summary: row.summary,
    area: row.area,
    buildingId: row.building_id,
    showPin: row.show_pin,
    occurredOn: row.occurred_on,
    fetchedAt: row.fetched_at,
  }));
}

type HelpRow = {
  id: string;
  title: string;
  description: string;
  requester_name: string;
  department: string;
  building_id: string | null;
  time_needed: string;
  skills: string[] | null;
  reward_type: HelpRequest["rewardType"];
  reward_detail: string;
  spots: number;
  status: HelpRequest["status"];
  created_by: string;
  created_at: string;
};

function toHelp(row: HelpRow): HelpRequest {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    requesterName: row.requester_name,
    department: row.department,
    buildingId: row.building_id,
    timeNeeded: row.time_needed,
    skills: row.skills ?? [],
    rewardType: row.reward_type,
    rewardDetail: row.reward_detail,
    spots: row.spots,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function subscribeToCampus(onChange: () => void): () => void {
  const channel = supabase
    .channel("campus-mobile")
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "food_rescues" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
