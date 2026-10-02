import { generateJson } from "@/lib/ai";
import { checkEventSchema } from "@/lib/ai-schemas";
import { checkEventDraft } from "@/lib/checks";
import { listBuildings } from "@/lib/db";
import { checkEventFixture } from "@/lib/fixtures";
import { checkEventPrompt } from "@/lib/prompts";
import type { CheckEventRequest, CheckEventResponse, EventIssue } from "@/lib/types";

export async function POST(request: Request) {
  const { event } = (await request.json()) as CheckEventRequest;
  if (!event) {
    return Response.json({ error: "Send an event." }, { status: 400 });
  }

  const buildings = await listBuildings();
  const codeIssues = checkEventDraft(event, buildings);

  // The model adds softer findings and follow-up questions. If it fails, the
  // exact code checks still stand, so the organizer is never blocked by the AI.
  let modelIssues: EventIssue[] = [];
  let questions: string[] = [];
  try {
    const result = await generateJson({
      prompt: checkEventPrompt(buildings, event, codeIssues),
      schema: checkEventSchema,
      fixture: checkEventFixture,
    });
    const flagged = new Set(codeIssues.map((issue) => issue.field));
    modelIssues = result.issues
      .filter((issue) => !flagged.has(issue.field))
      .map((issue) => ({ ...issue, severity: "warn" as const }));
    questions = result.questions.slice(0, 3);
  } catch {
    // Fall through with code checks only.
  }

  const issues = [...codeIssues, ...modelIssues];
  const response: CheckEventResponse = {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues,
    questions,
  };
  return Response.json(response);
}
