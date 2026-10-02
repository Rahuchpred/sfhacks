import { AI_MODEL, aiErrorResponse, getClient, isMock } from "@/lib/ai";

// Smoke test: confirms the API key works and shows which Gemma models exist.
export async function GET() {
  if (isMock()) {
    return Response.json({ mock: true, model: AI_MODEL });
  }
  try {
    const gemmaModels: string[] = [];
    for await (const model of await getClient().models.list()) {
      if (model.name?.includes("gemma")) gemmaModels.push(model.name);
    }
    const response = await getClient().models.generateContent({
      model: AI_MODEL,
      contents: "Reply with the single word: pong",
    });
    return Response.json({ mock: false, model: AI_MODEL, reply: response.text, gemmaModels });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
