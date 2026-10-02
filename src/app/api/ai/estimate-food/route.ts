import { aiErrorResponse, generateJson } from "@/lib/ai";
import { estimateFoodSchema } from "@/lib/ai-schemas";
import { estimateFoodFixture } from "@/lib/fixtures";
import { estimateFoodPrompt } from "@/lib/prompts";
import type { EstimateFoodRequest, EstimateFoodResponse } from "@/lib/types";

// Hours food stays claimable after posting. Set in code, never by the model.
const SAFE_HOURS = { perishable: 2, shelf_stable: 8 };

export async function POST(request: Request) {
  const { imageUrl, postedAt } = (await request.json()) as EstimateFoodRequest;
  if (!imageUrl) {
    return Response.json({ error: "Send an imageUrl." }, { status: 400 });
  }
  try {
    const estimate = await generateJson({
      prompt: estimateFoodPrompt(),
      imageUrl,
      schema: estimateFoodSchema,
      fixture: estimateFoodFixture,
    });

    const posted = new Date(postedAt);
    const base = Number.isNaN(posted.getTime()) ? new Date() : posted;
    const hours = SAFE_HOURS[estimate.category];
    const response: EstimateFoodResponse = {
      items: estimate.items,
      portions: estimate.portions,
      dietary: estimate.dietary,
      safeUntil: new Date(base.getTime() + hours * 3600_000).toISOString(),
      note:
        estimate.category === "perishable"
          ? "Cooked or perishable food is safe for about 2 hours after it is set out."
          : "Sealed packaged food is fine for about 8 hours.",
    };
    return Response.json(response);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
