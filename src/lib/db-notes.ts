// Host notes written after an event, for the club and the AI insights only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

const db = supabase as unknown as SupabaseClient;

export type HostNote = { eventId: string; title: string; note: string };

export async function getHostNotes(eventId: string): Promise<string> {
  const { data, error } = await db.from("events").select("host_notes").eq("id", eventId).single();
  if (error) throw error;
  return (data?.host_notes as string) ?? "";
}

export async function saveHostNotes(eventId: string, note: string): Promise<void> {
  const { error } = await db.from("events").update({ host_notes: note.slice(0, 1000) }).eq("id", eventId);
  if (error) throw error;
}

export async function listHostNotes(eventIds: string[]): Promise<HostNote[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await db.from("events").select("id, title, host_notes").in("id", eventIds);
  if (error) throw error;
  return (data ?? [])
    .filter((row) => (row.host_notes as string)?.trim())
    .map((row) => ({ eventId: row.id as string, title: row.title as string, note: row.host_notes as string }));
}
