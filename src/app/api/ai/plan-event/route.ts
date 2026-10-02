import { aiErrorResponse } from "@/lib/ai";
import { listBuildings } from "@/lib/db";
import { listEventsBetween, listPastEvents, loadAudience, loadCampus } from "@/lib/db-planner";
import {
  addDays,
  campusToIso,
  forecastTurnout,
  planOptions,
  reasonUsesOnlyFacts,
  resolveConstraints,
  toPlanOption,
} from "@/lib/planner";
import {
  cleanIdea,
  generateJsonFast,
  planIdeaFixture,
  planIdeaPrompt,
  planIdeaSchema,
  planReasonsFixture,
  planReasonsPrompt,
  planReasonsSchema,
} from "@/lib/planner-ai";
import type { PlanEventRequest, PlanEventResponse } from "@/lib/planner-types";

const MAX_TRANSCRIPT = 4000;

// Three steps. The AI reads the transcript into an idea. Code finds free rooms, the
// forecast, the clashes and the ranking. The AI words one reason per option, and a
// reason that brings a number of its own is replaced by the code-written one.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PlanEventRequest | null;
  const transcript = body?.transcript?.trim() ?? "";
  if (transcript.length < 3) {
    return Response.json({ error: "Send a transcript." }, { status: 400 });
  }

  try {
    const now = Date.now();
    const buildings = await listBuildings();
    const output = await generateJsonFast({
      prompt: planIdeaPrompt(transcript.slice(0, MAX_TRANSCRIPT), buildings, new Date(now)),
      schema: planIdeaSchema,
      fixture: planIdeaFixture,
    });
    const { idea, wish } = cleanIdea(output, buildings);
    const constraints = resolveConstraints(wish, idea.durationMinutes, now);

    const firstDay = constraints.dates[0];
    const lastDay = constraints.dates[constraints.dates.length - 1];
    const [{ campus, source }, past, events, audience] = await Promise.all([
      loadCampus(),
      listPastEvents(now),
      listEventsBetween(campusToIso(firstDay, 0), campusToIso(addDays(lastDay, 1), 0)),
      loadAudience(request, body?.clubId),
    ]);

    const target = {
      clubId: body?.clubId ?? null,
      tags: idea.tags,
      hasFood: idea.hasFood,
      hostEstimate: idea.expectedPeople,
    };
    const options = planOptions({
      campus,
      events,
      past,
      buildingNames: new Map(buildings.map((building) => [building.id, building.name])),
      target,
      audience,
      now,
      constraints,
      expectedPeople: idea.expectedPeople,
    });

    if (options.length > 0) {
      try {
        const { reasons } = await generateJsonFast({
          prompt: planReasonsPrompt(idea, options.map((option) => option.facts)),
          schema: planReasonsSchema,
          fixture: planReasonsFixture,
        });
        for (const { option: index, reason } of reasons) {
          const option = options[index - 1];
          const text = reason.replace(/[\u2013\u2014]/g, ",").trim();
          if (option && text.length > 0 && text.length <= 200 && reasonUsesOnlyFacts(text, option.facts)) {
            option.reason = text;
          }
        }
      } catch {
        // The code-written reasons stay.
      }
    }

    const response: PlanEventResponse = {
      idea,
      forecast:
        options[0]?.forecast ??
        forecastTurnout({ ...target, startsAt: campusToIso(firstDay, constraints.earliestMinute) }, past, now),
      options: options.map(toPlanOption),
      source,
    };
    return Response.json(response);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
