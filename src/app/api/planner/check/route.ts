import { EVENT_TAGS } from "@/lib/checks";
import { listBuildings } from "@/lib/db";
import { listEventsBetween, listPastEvents, loadAudience, loadCampus } from "@/lib/db-planner";
import { checkSlot, toPlanOption } from "@/lib/planner";
import type { PlannerCheckRequest, PlannerCheckResponse } from "@/lib/planner-types";

const DAY_MS = 86400_000;

// Forecast, clashes and better slots for one chosen place and time. Code only, no AI.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PlannerCheckRequest | null;
  const start = Date.parse(body?.startsAt ?? "");
  const end = Date.parse(body?.endsAt ?? "");
  if (!body?.buildingId || Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return Response.json({ error: "Send buildingId, startsAt and a later endsAt." }, { status: 400 });
  }

  try {
    const now = Date.now();
    const [{ campus }, buildings, past, events, audience] = await Promise.all([
      loadCampus(),
      listBuildings(),
      listPastEvents(now),
      // Better slots are looked for up to three days around the chosen time.
      listEventsBetween(new Date(start - 3 * DAY_MS).toISOString(), new Date(end + 4 * DAY_MS).toISOString()),
      loadAudience(request, body.clubId),
    ]);
    if (!buildings.some((building) => building.id === body.buildingId)) {
      return Response.json({ error: "That building is not on the campus list." }, { status: 400 });
    }

    const tags = (body.tags ?? []).filter((tag) => (EVENT_TAGS as readonly string[]).includes(tag));
    const result = checkSlot({
      campus,
      events,
      past,
      buildingNames: new Map(buildings.map((building) => [building.id, building.name])),
      target: { clubId: body.clubId ?? null, tags, hasFood: Boolean(body.hasFood) },
      audience,
      now,
      buildingId: body.buildingId,
      room: body.room?.trim() || null,
      window: { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() },
    });

    const response: PlannerCheckResponse = {
      forecast: result.forecast,
      clashes: result.clashes,
      betterSlots: result.betterSlots.map(toPlanOption),
    };
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The check failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
