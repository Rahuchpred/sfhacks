// Reads for the event planner. Server only: the routes in src/app/api/planner and
// src/app/api/ai/plan-event call these, then src/lib/planner.ts does the math.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { userFromRequest } from "@/lib/supabase/server";
import {
  buildCampus,
  type Audience,
  type Campus,
  type ClassSection,
  type OtherEvent,
  type PastEvent,
  type PlannerRoom,
} from "@/lib/planner";

// rooms, class_sections and club_audience_majors are newer than database.types.ts.
const db = supabase as unknown as SupabaseClient;

type RoomRow = { building_id: string; room: string; capacity: number; kind: string; sample: boolean };
type SectionRow = {
  class_number: string | null;
  subject: string;
  number: string;
  title: string;
  building_id: string | null;
  room: string | null;
  days: string[];
  start_time: string;
  end_time: string;
  starts_on: string | null;
  ends_on: string | null;
  enrolled: number;
  sample: boolean;
};

export type CampusData = {
  campus: Campus;
  source: { classSections: number; rooms: number; sample: boolean };
};

const PAGE = 1000;
const CACHE_MS = 10 * 60_000;
const HISTORY_DAYS = 365;

// "16:00:00" becomes 960.
function minutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

async function allRows<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

let cached: { at: number; data: Promise<CampusData> } | null = null;

// Rooms and the class schedule change once a term, so they are kept in memory
// for ten minutes. This is what makes /api/planner/check instant.
export function loadCampus(): Promise<CampusData> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  const data = (async () => {
    const [roomRows, sectionRows] = await Promise.all([
      allRows<RoomRow>("rooms", "building_id, room, capacity, kind, sample"),
      allRows<SectionRow>(
        "class_sections",
        "class_number, subject, number, title, building_id, room, days, start_time, end_time, starts_on, ends_on, enrolled, sample",
      ),
    ]);
    const rooms: PlannerRoom[] = roomRows.map((row) => ({
      buildingId: row.building_id,
      room: row.room,
      capacity: row.capacity,
      kind: row.kind,
    }));
    const sections: ClassSection[] = sectionRows.map((row) => ({
      classNumber: row.class_number,
      subject: row.subject,
      number: row.number,
      title: row.title,
      buildingId: row.building_id,
      room: row.room,
      days: row.days,
      startMinute: minutes(row.start_time),
      endMinute: minutes(row.end_time),
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      enrolled: row.enrolled,
    }));
    return {
      campus: buildCampus(rooms, sections),
      source: {
        classSections: sections.length,
        rooms: rooms.length,
        sample: roomRows.some((row) => row.sample) || sectionRows.some((row) => row.sample),
      },
    };
  })();
  cached = { at: Date.now(), data };
  data.catch(() => {
    cached = null;
  });
  return data;
}

// Events that already started and had at least one door check-in. An event with no
// check-ins tells us nothing: the host may not have used check-in at all.
export async function listPastEvents(now: number = Date.now()): Promise<PastEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, club_id, tags, building_id, starts_at, checked_in_count")
    .lt("starts_at", new Date(now).toISOString())
    .gte("starts_at", new Date(now - HISTORY_DAYS * 86400_000).toISOString())
    .gt("checked_in_count", 0)
    .order("starts_at", { ascending: false })
    .limit(PAGE);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    clubId: row.club_id,
    tags: row.tags,
    buildingId: row.building_id,
    startsAt: row.starts_at,
    checkedIn: row.checked_in_count,
  }));
}

// Events that overlap the range, for room use and event clashes.
export async function listEventsBetween(from: string, to: string): Promise<OtherEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, club_id, building_id, room, starts_at, ends_at, tags, rsvp_count")
    .lt("starts_at", to)
    .gt("ends_at", from)
    .order("starts_at")
    .limit(PAGE);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    clubId: row.club_id,
    buildingId: row.building_id,
    room: row.room,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    tags: row.tags,
    rsvpCount: row.rsvp_count,
  }));
}

// Majors of the club's past attendees, as counts. Only an organizer of the club
// gets them (the database checks), everyone else gets null.
export async function loadAudience(request: Request, clubId?: string | null): Promise<Audience> {
  if (!clubId) return null;
  const context = await userFromRequest(request);
  if (!context) return null;
  const client = context.supabase as unknown as SupabaseClient;
  const { data, error } = await client.rpc("club_audience_majors", { p_club_id: clubId });
  if (error || !data || data.length === 0) return null;
  return (data as { major: string; attendees: number }[]).map((row) => ({
    major: row.major,
    attendees: row.attendees,
  }));
}
