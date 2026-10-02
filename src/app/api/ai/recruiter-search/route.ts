import { aiErrorResponse, generateJson } from "@/lib/ai";
import { recruiterSearchSchema } from "@/lib/ai-schemas";
import { recruiterSearchFixture } from "@/lib/fixtures";
import { recruiterSearchPrompt } from "@/lib/prompts";
import { notSignedIn, userFromRequest } from "@/lib/supabase/server";
import type { RecruiterSearchRequest, RecruiterSearchResponse } from "@/lib/types";

// Ranks opted-in students against a recruiter's query, for recruiters only. The model never sees
// names, emails or links, only major, year and scanned attendance.
export async function POST(request: Request) {
  const context = await userFromRequest(request);
  if (!context) return notSignedIn();
  const { supabase, user } = context;

  // Recruiters only. The database also returns no students to anyone else.
  const { data: me } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if ((me as { role?: string | null } | null)?.role !== "recruiter") {
    return Response.json({ error: "Only recruiters can search students." }, { status: 403 });
  }

  const { query } = (await request.json()) as RecruiterSearchRequest;
  if (!query?.trim()) return Response.json({ error: "Type what you are looking for." }, { status: 400 });

  try {
    // Both reads only return students who opted in (enforced in the database).
    const [{ data: profiles, error }, { data: attendance }] = await Promise.all([
      supabase.from("profiles").select("id, major, grad_year").eq("recruiter_visible", true),
      supabase.rpc("visible_attendance"),
    ]);
    if (error) throw error;

    const students = (profiles ?? [])
      .map((profile) => ({
        profileId: profile.id,
        major: profile.major,
        gradYear: profile.grad_year,
        events: (attendance ?? [])
          .filter((row) => row.profile_id === profile.id)
          .map((row) => ({
            eventId: row.event_id,
            title: row.title,
            clubName: row.club_name,
            tags: row.tags,
            startsAt: row.starts_at,
          })),
      }))
      .filter((student) => student.events.length > 0);

    if (students.length === 0) {
      const empty: RecruiterSearchResponse = { matches: [] };
      return Response.json(empty);
    }

    const result = await generateJson({
      prompt: recruiterSearchPrompt(query.trim().slice(0, 300), students),
      schema: recruiterSearchSchema,
      fixture: recruiterSearchFixture,
    });

    // Drop anything the model made up: unknown students, and events a student did not attend.
    const byId = new Map(students.map((student) => [student.profileId, student]));
    const matches = result.matches
      .filter((match) => byId.has(match.profileId))
      .map((match) => {
        const attended = new Set(byId.get(match.profileId)!.events.map((event) => event.eventId));
        return {
          ...match,
          evidenceEventIds: match.evidenceEventIds.filter((id) => attended.has(id)),
        };
      })
      .filter((match) => match.evidenceEventIds.length > 0)
      .slice(0, 8);

    const response: RecruiterSearchResponse = { matches };
    return Response.json(response);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
