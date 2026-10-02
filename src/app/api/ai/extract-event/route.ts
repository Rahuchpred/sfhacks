import { aiErrorResponse, generateJson } from "@/lib/ai";
import { extractEventSchema } from "@/lib/ai-schemas";
import { EVENT_TAGS, missingFields } from "@/lib/checks";
import { listBuildings } from "@/lib/db";
import { extractEventFixture } from "@/lib/fixtures";
import { extractEventPrompt } from "@/lib/prompts";
import type { ExtractEventRequest, ExtractEventResponse } from "@/lib/types";

export async function POST(request: Request) {
  const { text, imageUrl } = (await request.json()) as ExtractEventRequest;
  if (!text?.trim() && !imageUrl) {
    return Response.json({ error: "Send text or an imageUrl." }, { status: 400 });
  }
  try {
    const buildings = await listBuildings();
    const result = await generateJson({
      prompt: extractEventPrompt(buildings, text),
      imageUrl,
      schema: extractEventSchema,
      fixture: extractEventFixture,
    });

    // Never trust the model for ids or tags: keep only values that really exist.
    const event = result.event;
    if (!buildings.some((building) => building.id === event.buildingId)) {
      event.buildingId = null;
    }
    event.tags = event.tags.filter((tag) => (EVENT_TAGS as readonly string[]).includes(tag));

    const response: ExtractEventResponse = {
      event,
      missing: missingFields(event),
      confidence: result.confidence,
    };
    return Response.json(response);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
