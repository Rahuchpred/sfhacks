import { aiErrorResponse, generateJson } from "@/lib/ai";
import { hostInsightsSchema } from "@/lib/ai-schemas";
import { hostInsightsFixture } from "@/lib/fixtures";
import { hostInsightsPrompt } from "@/lib/prompts";
import { notSignedIn, userFromRequest } from "@/lib/supabase/server";
import type { HostInsightsRequest, HostInsightsResponse } from "@/lib/types";

// Turns already-counted club numbers into a few findings. The numbers come
// from aiStats() in src/lib/analytics.ts and contain no names.
export async function POST(request: Request) {
  const context = await userFromRequest(request);
  if (!context) return notSignedIn();

  const { stats } = (await request.json()) as HostInsightsRequest;
  if (!stats || JSON.stringify(stats).length > 20_000) {
    return Response.json({ error: "Send the stats to look at." }, { status: 400 });
  }

  try {
    const result: HostInsightsResponse = await generateJson({
      prompt: hostInsightsPrompt(stats),
      schema: hostInsightsSchema,
      fixture: hostInsightsFixture,
    });
    return Response.json(result);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
