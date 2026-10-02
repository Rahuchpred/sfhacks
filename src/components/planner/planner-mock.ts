// Stand-in answers for the planner routes, in the exact shapes of
// src/lib/planner-types.ts. Used only while USE_MOCK is true in planner-api.ts.
// Building ids are real rows of the buildings table. Rooms, classes and numbers are made up.
import { pacificIso, pacificParts } from "@/components/post/form-utils";
import type {
  Clash,
  EventIdea,
  Forecast,
  PlanEventRequest,
  PlanEventResponse,
  PlanOption,
  PlannerCheckRequest,
  PlannerCheckResponse,
} from "@/lib/planner-types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ROOMS = [
  { buildingId: "cesar-chavez", buildingName: "Cesar Chavez Student Center", room: "Rosa Parks A-C", capacity: 120 },
  { buildingId: "library", buildingName: "J. Paul Leonard Library", room: "121", capacity: 60 },
  { buildingId: "thornton", buildingName: "Thornton Hall", room: "429", capacity: 48 },
  { buildingId: "business", buildingName: "Business Building", room: "202", capacity: 80 },
  { buildingId: "annex", buildingName: "Annex I", room: "Main hall", capacity: 300 },
];

const TAG_WORDS: [RegExp, string][] = [
  [/boba|pizza|food|snack|donut|lunch|dinner/i, "free food"],
  [/game|social|mixer|meet|hang|party|night/i, "social"],
  [/resume|career|recruit|intern|alumni|network/i, "career"],
  [/workshop|study|talk|lecture|hack|code|learn/i, "academic"],
  [/culture|cultural|heritage|lunar|diwali/i, "cultural"],
  [/music|art|paint|film|open mic|poetry/i, "arts"],
  [/yoga|wellness|meditat/i, "wellness"],
];

function readIdea(transcript: string): EventIdea {
  const text = transcript.trim().replace(/\s+/g, " ");
  const tags = TAG_WORDS.filter(([pattern]) => pattern.test(text)).map(([, tag]) => tag);
  const people = text.match(/(\d{2,3})\s*(people|students|guests|folks)/i);
  const hours = text.match(/(\d(?:\.5)?)\s*(hours?|hrs?)/i);
  const when = text.match(/(next week|this week|tomorrow|(?:next |this )?(?:mon|tues|wednes|thurs|fri)day)[^.,]*/i);
  const words = text.replace(/^(we want to|i want to|we are planning|let's|lets)\s+(host|do|run|have|plan)?\s*(an?\s+)?/i, "");
  const title = words.split(/[.,]| (?:next|this|on|for|at|with|in) /i)[0].trim().slice(0, 48);
  return {
    title: title ? title[0].toUpperCase() + title.slice(1) : "New event",
    description: text,
    tags: tags.length > 0 ? tags.slice(0, 3) : ["social"],
    expectedPeople: people ? Number(people[1]) : null,
    durationMinutes: hours ? Math.round(Number(hours[1]) * 60) : 120,
    hasFood: tags.includes("free food"),
    when: when ? when[0].trim() : "next week",
  };
}

function forecastFor(expected: number, hasFood: boolean): Forecast {
  return {
    expected,
    low: Math.round(expected * 0.8),
    high: Math.round(expected * 1.25),
    confidence: "medium",
    basedOn: 4,
    reason: `Your last 4 evening events drew ${expected} on average`,
    food: hasFood
      ? { portions: Math.round(expected * 1.1), suggestion: "Order for the high end, food events fill up" }
      : null,
  };
}

// A campus day and wall-clock time, a number of days from today.
function slot(daysAhead: number, time: string, minutes: number) {
  const today = pacificParts(new Date())?.date ?? "";
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + daysAhead)).toISOString().slice(0, 10);
  const startsAt = pacificIso(date, time) ?? "";
  const endsAt = new Date(new Date(startsAt).getTime() + minutes * 60_000).toISOString();
  return { startsAt, endsAt };
}

// Days until the next given weekday (0 is Sunday), at least 2 days out.
function daysUntil(weekday: number): number {
  const today = new Date(`${pacificParts(new Date())?.date}T12:00:00Z`).getUTCDay();
  const gap = (weekday - today + 7) % 7;
  return gap < 2 ? gap + 7 : gap;
}

export async function mockPlanEvent(request: PlanEventRequest): Promise<PlanEventResponse> {
  await wait(1400);
  const idea = readIdea(request.transcript);
  const expected = idea.expectedPeople ?? 38;
  const fits = ROOMS.filter((room) => room.capacity >= expected * 1.25);
  const rooms = fits.length >= 3 ? fits : ROOMS.slice().sort((a, b) => b.capacity - a.capacity);
  const thursday = slot(daysUntil(4), "17:00", idea.durationMinutes);
  const wednesday = slot(daysUntil(3), "16:00", idea.durationMinutes);
  const tuesday = slot(daysUntil(2), "12:30", idea.durationMinutes);

  const options: PlanOption[] = [
    {
      ...rooms[0],
      ...thursday,
      score: 91,
      clashes: [],
      reason: "Free room, big enough, and no class your crowd takes meets then",
    },
    {
      ...rooms[1],
      ...wednesday,
      score: 78,
      clashes: [
        {
          kind: "class",
          label: "CSC 413 Software Development",
          startsAt: wednesday.startsAt,
          endsAt: new Date(new Date(wednesday.startsAt).getTime() + 75 * 60_000).toISOString(),
          audienceShare: 0.12,
          note: "A few of your regulars are in this class",
        },
      ],
      reason: "Good room, one small class overlaps the first hour",
    },
    {
      ...rooms[2],
      ...tuesday,
      score: 61,
      clashes: [
        {
          kind: "class",
          label: "CSC 340 Programming Methodology",
          startsAt: tuesday.startsAt,
          endsAt: new Date(new Date(tuesday.startsAt).getTime() + 75 * 60_000).toISOString(),
          audienceShare: 0.24,
          note: "About a quarter of your usual crowd is in class",
        },
        {
          kind: "event",
          label: "Farmers Market",
          startsAt: tuesday.startsAt,
          endsAt: tuesday.endsAt,
          audienceShare: null,
          note: "Another food event at the same time",
        },
      ],
      reason: "Lunch hour is busy, but the room is free",
    },
  ];

  return {
    idea,
    forecast: forecastFor(expected, idea.hasFood),
    options,
    source: { classSections: 412, rooms: 96, sample: true },
  };
}

export async function mockCheck(request: PlannerCheckRequest): Promise<PlannerCheckResponse> {
  await wait(250);
  const start = pacificParts(request.startsAt);
  const hour = start ? Number(start.time.slice(0, 2)) : 17;
  const evening = hour >= 16 && hour < 20;
  const forecast = forecastFor(evening ? 38 : 24, request.hasFood);
  if (!evening) forecast.reason = "Daytime events of this kind drew 24 on average";
  if (evening || !start) return { forecast, clashes: [], betterSlots: [] };

  const minutes = Math.max(
    30,
    Math.round((new Date(request.endsAt).getTime() - new Date(request.startsAt).getTime()) / 60_000),
  );
  const clashes: Clash[] = [
    {
      kind: "class",
      label: "CSC 340 Programming Methodology",
      startsAt: request.startsAt,
      endsAt: new Date(new Date(request.startsAt).getTime() + 75 * 60_000).toISOString(),
      audienceShare: 0.24,
      note: "About a quarter of your usual crowd is in class",
    },
  ];
  const place = ROOMS.find((room) => room.buildingId === request.buildingId) ?? ROOMS[0];
  const later = (time: string, addDays: number) => {
    const date = new Date(`${start.date}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + addDays);
    const startsAt = pacificIso(date.toISOString().slice(0, 10), time) ?? request.startsAt;
    return { startsAt, endsAt: new Date(new Date(startsAt).getTime() + minutes * 60_000).toISOString() };
  };
  const betterSlots: PlanOption[] = [
    { ...place, room: request.room || place.room, ...later("17:00", 0), score: 90, clashes: [], reason: "No class your crowd takes meets then" },
    { ...ROOMS[0], ...later("17:30", 1), score: 84, clashes: [], reason: "A bigger room is free the next day" },
  ];
  return { forecast, clashes, betterSlots };
}
