// Data for the faculty attendance page. Kept apart from db.ts, like db-planner.ts.
import { supabase } from "@/lib/supabase/client";
import { toEvent } from "@/lib/db";
import type { CampusEvent } from "@/lib/types";

export type Attendee = {
  id: string;
  name: string;
  major: string;
  gradYear: number | null;
  sfsuVerified: boolean;
  checkedInAt: string;
};

// Every campus event that has started, newest first.
export async function listStartedEvents(): Promise<CampusEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .lte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map(toEvent);
}

// Students checked in at the door of one event. Empty for anyone who is not faculty.
export async function listEventAttendees(eventId: string): Promise<Attendee[]> {
  const { data, error } = await supabase.rpc("faculty_event_attendance", { p_event_id: eventId });
  if (error) throw error;
  return data.map((row) => ({
    id: row.guest_id,
    name: row.guest_name,
    major: row.major,
    gradYear: row.grad_year,
    sfsuVerified: row.sfsu_verified,
    checkedInAt: row.checked_in_at,
  }));
}
