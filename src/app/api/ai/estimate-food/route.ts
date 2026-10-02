import { aiErrorResponse, generateJson } from "@/lib/ai";
import { estimateFoodSchema } from "@/lib/ai-schemas";
import { estimateFoodFixture } from "@/lib/fixtures";
import { estimateFoodPrompt } from "@/lib/prompts";
import type { EstimateFoodRequest, EstimateFoodResponse } from "@/lib/types";

export async function POST(request: Request) {
  const { imageUrl, postedAt } = (await request.json()) as EstimateFoodRequest;
  if (!imageUrl) {
    return Response.json({ error: "Send an imageUrl." }, { status: 400 });
  }
  try {
    const result: EstimateFoodResponse = await generateJson({
      prompt: estimateFoodPrompt(postedAt ?? new Date().toISOString()),
      imageUrl,
      schema: estimateFoodSchema,
      fixture: estimateFoodFixture,
    });
    return Response.json(result);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
