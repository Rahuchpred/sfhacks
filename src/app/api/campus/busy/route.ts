import type { SupabaseClient } from "@supabase/supabase-js";
import { busyAt } from "@/lib/busy";
import { loadCampus } from "@/lib/db-planner";
import { supabase } from "@/lib/supabase/client";

const db = supabase as unknown as SupabaseClient;

// GET /api/campus/busy?at=<ISO time>: students per building right now, from the class
// schedule and live check-ins. Public, no AI. Without `at` it answers for now.
export async function GET(request: Request) {
  const param = new URL(request.url).searchParams.get("at");
  const at = param ? new Date(param) : new Date();
  if (Number.isNaN(at.getTime())) {
    return Response.json({ error: "Bad time." }, { status: 400 });
  }
  try {
    const iso = at.toISOString();
    const [{ campus, source }, live] = await Promise.all([
      loadCampus(),
      db
        .from("events")
        .select("building_id, checked_in_count")
        .lte("starts_at", iso)
        .gte("ends_at", iso),
    ]);
    if (live.error) throw new Error(live.error.message);
    const liveEvents = (live.data ?? []).map((row) => ({
      buildingId: row.building_id as string,
      checkedIn: (row.checked_in_count as number) ?? 0,
    }));
    return Response.json(busyAt(campus, liveEvents, at, source.sample), {
      headers: { "cache-control": "public, max-age=60" },
    });
  } catch {
    return Response.json({ error: "Could not load how busy campus is." }, { status: 500 });
  }
}
