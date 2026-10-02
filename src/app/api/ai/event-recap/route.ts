import { aiErrorResponse, generateJson } from "@/lib/ai";
import { eventRecapSchema } from "@/lib/ai-schemas";
import { eventRecapFixture } from "@/lib/fixtures";
import { eventRecapPrompt } from "@/lib/prompts";
import { notSignedIn, userFromRequest } from "@/lib/supabase/server";
import type { EventRecapRequest, EventRecapResponse, EventRecapStats } from "@/lib/types";

// Host only. Every number is counted here in code. The model only writes the sentences.
export async function POST(request: Request) {
  const context = await userFromRequest(request);
  if (!context) return notSignedIn();
  const { supabase, user } = context;

  const { eventId } = (await request.json()) as EventRecapRequest;
  if (!eventId) return Response.json({ error: "Send an eventId." }, { status: 400 });

  try {
    const { data: event, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();
    if (error) throw error;
    if (!event) return Response.json({ error: "Event not found." }, { status: 404 });
    if (event.created_by !== user.id) {
      return Response.json({ error: "Only the host can see the recap." }, { status: 403 });
    }

    const [{ data: guests }, { data: rescues }] = await Promise.all([
      supabase.rpc("event_guests", { p_event_id: eventId }),
      supabase.from("food_rescues").select("portions, portions_left").eq("event_id", eventId),
    ]);

    const going = guests?.length ?? 0;
    const checkedIn = guests?.filter((guest) => guest.checked_in_at).length ?? 0;
    const portionsPosted = rescues?.reduce((sum, rescue) => sum + rescue.portions, 0) ?? 0;
    const portionsLeft = rescues?.reduce((sum, rescue) => sum + rescue.portions_left, 0) ?? 0;
    const stats: EventRecapStats = {
      going,
      checkedIn,
      turnoutPercent: going > 0 ? Math.round((checkedIn / going) * 100) : null,
      verifiedGuests: guests?.filter((guest) => guest.sfsu_verified).length ?? 0,
      foodPosts: rescues?.length ?? 0,
      portionsPosted,
      portionsClaimed: portionsPosted - portionsLeft,
    };

    const result = await generateJson({
      prompt: eventRecapPrompt(
        {
          title: event.title,
          clubName: event.club_name,
          startsAt: event.starts_at,
          tags: event.tags,
        },
        stats,
      ),
      schema: eventRecapSchema,
      fixture: eventRecapFixture,
    });
    const response: EventRecapResponse = { recap: result.recap, stats };
    return Response.json(response);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
