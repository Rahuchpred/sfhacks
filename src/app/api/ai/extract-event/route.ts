import { aiErrorResponse, generateJson } from "@/lib/ai";
import { extractEventSchema } from "@/lib/ai-schemas";
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
    const result: ExtractEventResponse = await generateJson({
      prompt: extractEventPrompt(buildings, text),
      imageUrl,
      schema: extractEventSchema,
      fixture: extractEventFixture,
    });
    return Response.json(result);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
