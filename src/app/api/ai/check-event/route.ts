import { checkEventDraft } from "@/lib/checks";
import { listBuildings } from "@/lib/db";
import type { CheckEventRequest, CheckEventResponse } from "@/lib/types";

// Exact checks in code, with no model call, so the answer is instant. The same
// checkEventDraft() runs in the browser as the organizer types.
export async function POST(request: Request) {
  const { event } = (await request.json()) as CheckEventRequest;
  if (!event) {
    return Response.json({ error: "Send an event." }, { status: 400 });
  }

  const issues = checkEventDraft(event, await listBuildings());
  const response: CheckEventResponse = {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues,
    questions: [],
  };
  return Response.json(response);
}
