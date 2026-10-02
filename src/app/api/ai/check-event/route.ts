import { aiErrorResponse, generateJson } from "@/lib/ai";
import { checkEventSchema } from "@/lib/ai-schemas";
import { listBuildings } from "@/lib/db";
import { checkEventFixture } from "@/lib/fixtures";
import { checkEventPrompt } from "@/lib/prompts";
import type { CheckEventRequest, CheckEventResponse } from "@/lib/types";

export async function POST(request: Request) {
  const { event } = (await request.json()) as CheckEventRequest;
  if (!event) {
    return Response.json({ error: "Send an event." }, { status: 400 });
  }
  try {
    const buildings = await listBuildings();
    const result: CheckEventResponse = await generateJson({
      prompt: checkEventPrompt(buildings, event),
      schema: checkEventSchema,
      fixture: checkEventFixture,
    });
    return Response.json(result);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
