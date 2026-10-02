// The planner's two calls. Everything in the UI goes through this file.
import { postJson } from "@/lib/api";
import type {
  PlanEventRequest,
  PlanEventResponse,
  PlannerCheckRequest,
  PlannerCheckResponse,
} from "@/lib/planner-types";
import { mockCheck, mockPlanEvent } from "./planner-mock";

// THE SWITCH. True answers from planner-mock.ts. Set it to false once
// POST /api/ai/plan-event and POST /api/planner/check are merged.
export const USE_MOCK = true;

// Speech or typed idea to an understood idea, a forecast and up to three options. One AI call.
export function planEvent(request: PlanEventRequest): Promise<PlanEventResponse> {
  return USE_MOCK ? mockPlanEvent(request) : postJson("/api/ai/plan-event", request);
}

// Forecast, clashes and better slots for one place and time. Code only, no AI.
export function checkSlot(request: PlannerCheckRequest): Promise<PlannerCheckResponse> {
  return USE_MOCK ? mockCheck(request) : postJson("/api/planner/check", request);
}
