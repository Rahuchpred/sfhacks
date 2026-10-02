import { aiErrorResponse, generateJson } from "@/lib/ai";
import { profileSummarySchema } from "@/lib/ai-schemas";
import { profileSummaryFixture } from "@/lib/fixtures";
import { profileSummaryPrompt } from "@/lib/prompts";
import { notSignedIn, userFromRequest } from "@/lib/supabase/server";
import type { ProfileSummaryResponse } from "@/lib/types";

// Writes a summary from the signed-in student's real check-ins. The server
// reads them itself, so a client cannot pass in events that never happened.
export async function POST(request: Request) {
  const context = await userFromRequest(request);
  if (!context) return notSignedIn();
  const { supabase, user } = context;

  try {
    const [{ data: profile }, { data: rsvps, error }] = await Promise.all([
      supabase.from("profiles").select("major, grad_year").eq("id", user.id).maybeSingle(),
      supabase
        .from("rsvps")
        .select("checked_in_at, events(title, club_name, tags, starts_at)")
        .not("checked_in_at", "is", null),
    ]);
    if (error) throw error;

    const events = (rsvps ?? [])
      .filter((row) => row.events)
      .map((row) => ({
        title: row.events.title,
        clubName: row.events.club_name,
        tags: row.events.tags,
        startsAt: row.events.starts_at,
      }));

    if (events.length === 0) {
      const empty: ProfileSummaryResponse = { summary: null, reason: "no_checkins" };
      return Response.json(empty);
    }

    const result = await generateJson({
      prompt: profileSummaryPrompt(
        { major: profile?.major ?? "", gradYear: profile?.grad_year ?? null },
        events,
      ),
      schema: profileSummarySchema,
      fixture: profileSummaryFixture,
    });
    const response: ProfileSummaryResponse = { summary: result.summary, reason: null };
    return Response.json(response);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
