// Shared contract for the event planner (round 4). The data agent implements the routes
// that return these shapes, the planner UI agent consumes them. Do not change a field
// without telling the main thread.

export type Confidence = "low" | "medium" | "high";

// How many people we expect, computed in code from past check-ins.
export type Forecast = {
  expected: number;
  low: number;
  high: number;
  confidence: Confidence;
  // How many past events the numbers are based on.
  basedOn: number;
  // One short sentence, for example "Your last 4 Thursday events drew 38 on average".
  reason: string;
  // Present only when the event has food.
  food: { portions: number; suggestion: string } | null;
};

// Something that competes for the same audience at the same time.
export type Clash = {
  kind: "class" | "event";
  // For example "CSC 413 Software Development" or the event title.
  label: string;
  startsAt: string;
  endsAt: string;
  // Share of this club's usual audience that is busy, 0 to 1. Null when unknown.
  audienceShare: number | null;
  note: string;
};

// One place and time the event could happen.
export type PlanOption = {
  buildingId: string;
  buildingName: string;
  room: string;
  capacity: number;
  startsAt: string;
  endsAt: string;
  // 0 to 100, higher is better. Computed in code.
  score: number;
  clashes: Clash[];
  // One short sentence written by the AI from the facts above.
  reason: string;
};

// What the AI understood from the spoken or typed idea.
export type EventIdea = {
  title: string;
  description: string;
  tags: string[];
  expectedPeople: number | null;
  durationMinutes: number;
  hasFood: boolean;
  // The time wish in the speaker's words, for example "next week, after 4pm".
  when: string;
};

// POST /api/ai/plan-event
export type PlanEventRequest = { transcript: string; clubId?: string };
export type PlanEventResponse = {
  idea: EventIdea;
  forecast: Forecast;
  // Best first, at most 3.
  options: PlanOption[];
  // Where the schedule data came from. `sample` is true when it is not the real SFSU schedule.
  source: { classSections: number; rooms: number; sample: boolean };
};

// POST /api/planner/check. Code only, instant, no AI.
export type PlannerCheckRequest = {
  clubId?: string;
  tags: string[];
  buildingId: string;
  room?: string;
  startsAt: string;
  endsAt: string;
  hasFood: boolean;
  // The host's own estimate from the planner. Used only when there is no history.
  expectedPeople?: number | null;
};
export type PlannerCheckResponse = {
  forecast: Forecast;
  clashes: Clash[];
  // Up to 3 better slots near the chosen time. Empty when the chosen slot is fine.
  betterSlots: PlanOption[];
};
