import { aiErrorResponse, generateJson } from "@/lib/ai";
import { structureHelpSchema } from "@/lib/ai-schemas";
import { listBuildings } from "@/lib/db";
import { structureHelpFixture } from "@/lib/fixtures";
import { structureHelpPrompt } from "@/lib/prompts";
import {
  REWARD_TYPES,
  type RewardType,
  type StructureHelpRequest,
  type StructureHelpResponse,
} from "@/lib/types";

// Turns a faculty member's plain words into a structured help request.
export async function POST(request: Request) {
  const { text } = (await request.json()) as StructureHelpRequest;
  if (!text?.trim()) {
    return Response.json({ error: "Describe what you need help with." }, { status: 400 });
  }
  try {
    const buildings = await listBuildings();
    const result = await generateJson({
      prompt: structureHelpPrompt(buildings, text.trim().slice(0, 2000)),
      schema: structureHelpSchema,
      fixture: structureHelpFixture,
    });

    // Keep only values that really exist. A missing reward stays missing, so the
    // requester has to say what the student gets.
    const response: StructureHelpResponse = {
      title: result.title,
      description: result.description,
      timeNeeded: result.timeNeeded,
      skills: result.skills.slice(0, 4),
      rewardType: (REWARD_TYPES as readonly string[]).includes(result.rewardType ?? "")
        ? (result.rewardType as RewardType)
        : null,
      rewardDetail: result.rewardDetail,
      buildingId: buildings.some((building) => building.id === result.buildingId)
        ? result.buildingId
        : null,
    };
    return Response.json(response);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
