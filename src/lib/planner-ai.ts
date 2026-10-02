// Prompts, schemas and fixtures for the event planner. The AI reads the host's words
// and writes short reasons. Rooms, times and numbers come from src/lib/planner.ts.
import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { AI_MODEL, getClient, isMock } from "@/lib/ai";
import { EVENT_TAGS, TIMEZONE } from "@/lib/checks";
import type { OptionFacts, TimeWish } from "@/lib/planner";
import type { EventIdea } from "@/lib/planner-types";
import type { Building } from "@/lib/types";

// The same contract as generateJson() in src/lib/ai.ts (JSON mode, zod, one retry with
// the error fed back, the fixture under AI_MOCK=1), plus one setting: the model skips
// its long thinking step. The planner runs by itself when the host stops talking, so it
// has to answer in seconds. Measured on the reasons prompt: 3 seconds, against 17 to 170.
export async function generateJsonFast<T>(options: {
  prompt: string;
  schema: z.ZodType<T>;
  fixture: T;
}): Promise<T> {
  if (isMock()) return options.fixture;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote = lastError
      ? `\n\nYour previous reply was invalid: ${lastError}\nReply again with only the corrected JSON object.`
      : "";
    const response = await getClient().models.generateContent({
      model: AI_MODEL,
      contents: [{ role: "user", parts: [{ text: options.prompt + retryNote }] }],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
    try {
      const text = response.text ?? "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end <= start) throw new Error("Model returned no JSON object.");
      return options.schema.parse(JSON.parse(text.slice(start, end + 1)));
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 500) : "invalid JSON";
    }
  }
  throw new Error(`AI reply could not be parsed: ${lastError}`);
}

const nullableString = z.string().nullable().catch(null);
const nullableNumber = z.number().nullable().catch(null);

// What the model returns for a transcript: the idea, plus the time wish as fields
// that code can check. The wish fields never reach the client.
export const planIdeaSchema = z.object({
  title: z.string().min(1),
  description: z.string().catch(""),
  tags: z.array(z.string()).catch([]),
  expectedPeople: nullableNumber,
  durationMinutes: z.number().catch(90),
  hasFood: z.boolean().catch(false),
  when: z.string().catch(""),
  dateFrom: nullableString,
  dateTo: nullableString,
  weekdays: z.array(z.string()).catch([]),
  earliestHour: nullableNumber,
  latestHour: nullableNumber,
  buildingId: nullableString,
});
export type PlanIdeaOutput = z.infer<typeof planIdeaSchema>;

export const planReasonsSchema = z.object({
  reasons: z.array(z.object({ option: z.number(), reason: z.string() })).catch([]),
});

function today(now: Date): string {
  return now.toLocaleString("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function planIdeaPrompt(transcript: string, buildings: Building[], now: Date = new Date()): string {
  const isoToday = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(now);
  return `A club organizer at San Francisco State University described an event idea out loud. The text below is the speech transcript, so it may ramble or have small mistakes. Turn it into one event idea.

Today at SF State is ${today(now)} (${isoToday}).

Campus buildings:
${buildings.map((b) => `- ${b.id}: ${b.name}${b.aliases.length ? ` (also: ${b.aliases.join(", ")})` : ""}`).join("\n")}

Reply with only this JSON object:
{
  "title": string,                 // short event title, 2 to 6 words
  "description": string,           // 1 or 2 clear sentences for students
  "tags": string[],                // 1 to 3 of: ${EVENT_TAGS.join(", ")}
  "expectedPeople": number | null, // only if the speaker says how many people, else null
  "durationMinutes": number,       // what the speaker says, else 90
  "hasFood": boolean,              // true only if the speaker mentions food or drinks
  "when": string,                  // the time wish in the speaker's own words, "" if none
  "dateFrom": string | null,       // first possible day as YYYY-MM-DD, null if not said
  "dateTo": string | null,         // last possible day as YYYY-MM-DD, null if not said
  "weekdays": string[],            // only weekdays the speaker asks for: mon, tue, wed, thu, fri, sat, sun
  "earliestHour": number | null,   // earliest start, 24 hour clock, null if not said
  "latestHour": number | null,     // latest end, 24 hour clock, null if not said
  "buildingId": string | null      // a building id from the list, only if the speaker names it
}

Rules:
- Use only what the speaker said. Never guess a number of people, a date or a building.
- "next week" means Monday to Friday of the week after this one. "this week" ends this Friday. "tomorrow" is one day.
- "after 4pm" gives earliestHour 16. "evening" gives earliestHour 17. "morning" gives latestHour 12. "afternoon" gives earliestHour 12 and latestHour 17. "lunch" gives earliestHour 11 and latestHour 14.
- Add the tag "free food" only when hasFood is true.
- Do not pick a room or an exact start time. Code does that from the class schedule.

Transcript:
"""
${transcript}
"""`;
}

// The mock idea for AI_MOCK=1: fixed, whatever the transcript says.
export const planIdeaFixture: PlanIdeaOutput = {
  title: "Intro to Machine Learning Workshop",
  description: "A hands-on workshop for beginners. Bring a laptop, pizza is provided.",
  tags: ["academic", "career", "free food"],
  expectedPeople: 40,
  durationMinutes: 90,
  hasFood: true,
  when: "next week, after 4pm",
  dateFrom: null,
  dateTo: null,
  weekdays: [],
  earliestHour: 16,
  latestHour: null,
  buildingId: null,
};

export function planReasonsPrompt(idea: EventIdea, facts: OptionFacts[]): string {
  return `A campus event planner picked the best rooms and times for an event with code. Write one short reason for each option so the organizer sees why it is a good pick.

Event: ${idea.title}

Options (facts computed by code, all percentages are whole numbers):
${JSON.stringify(facts.map((fact, index) => ({ option: index + 1, ...fact })), null, 2)}

What the facts mean:
- capacity: seats in the room. expectedPeople: the turnout forecast.
- audienceInClassPercent: percent of this club's usual attendees who are in class at that time. Lower is better. null means unknown, do not mention it.
- campusInClassPercent: how full campus classes are at that time, where 100 is the busiest hour of the week. Lower is better.
- studentsAroundPercent: how many students have a class right before or right after, so they are already on campus, where 100 is the busiest hour. Higher is better. null means unknown, do not mention it.
- clashes: classes or events at the same time that pull the same audience. An empty list means no clashes.

Examples of the style (the numbers are from other events, do not copy them):
- "Classes are light, many students are still on campus, and the room seats 45 for your 30."
- "No clashes, and only 6% of your usual crowd is in class."

Reply with only this JSON object:
{ "reasons": [ { "option": number, "reason": string } ] }

Rules:
- One sentence per option, at most 20 words, plain words a student would use. Say why the slot is good, not what the fields are called.
- Make the reasons different from each other: name what is special about each option.
- Use only the facts above. Every number you write must appear in that option's facts exactly as given.
- Do not mention a room, a time or a date that is not in that option's facts.
- No dashes. Do not say "score".`;
}

// Under AI_MOCK=1 there are no AI reasons, so the code-written reasons are shown.
export const planReasonsFixture: z.infer<typeof planReasonsSchema> = { reasons: [] };

function clampInt(value: number | null, min: number, max: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.min(Math.max(Math.round(value), min), max);
}

// Keeps only values that can be true: real tags, real building ids, sane numbers.
export function cleanIdea(
  output: PlanIdeaOutput,
  buildings: Building[],
): { idea: EventIdea; wish: TimeWish } {
  const hasFood = output.hasFood;
  const tags = [...new Set(output.tags.map((tag) => tag.toLowerCase().trim()))]
    .filter((tag) => (EVENT_TAGS as readonly string[]).includes(tag))
    .filter((tag) => tag !== "free food" || hasFood);
  if (hasFood && !tags.includes("free food")) tags.push("free food");

  return {
    idea: {
      title: output.title.trim().slice(0, 120),
      description: output.description.trim().slice(0, 600),
      tags,
      expectedPeople: clampInt(output.expectedPeople, 1, 2000),
      durationMinutes: clampInt(output.durationMinutes, 30, 480) ?? 90,
      hasFood,
      when: output.when.trim().slice(0, 200),
    },
    wish: {
      dateFrom: output.dateFrom,
      dateTo: output.dateTo,
      weekdays: output.weekdays,
      earliestHour: output.earliestHour,
      latestHour: output.latestHour,
      buildingId: buildings.some((building) => building.id === output.buildingId) ? output.buildingId : null,
    },
  };
}
