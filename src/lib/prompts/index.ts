// Prompt builders. Starter versions: Thread B owns and improves these.
import { EVENT_TAGS, TIMEZONE } from "@/lib/checks";
import type { Building, EventDraft, EventIssue } from "@/lib/types";

function nowLine(): string {
  const now = new Date();
  const local = now.toLocaleString("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Current date and time at SF State (Pacific time): ${local}.`;
}

function buildingList(buildings: Building[]): string {
  return buildings
    .map((b) => `- ${b.id}: ${b.name}${b.aliases.length ? ` (also: ${b.aliases.join(", ")})` : ""}`)
    .join("\n");
}

const EVENT_SHAPE = `{
  "title": string | null,
  "description": string | null,   // 1-2 clear sentences
  "clubName": string | null,
  "buildingId": string | null,    // must be an id from the building list, or null
  "room": string | null,
  "startsAt": string | null,      // ISO 8601 with Pacific offset, e.g. 2026-10-08T17:00:00-07:00
  "endsAt": string | null,
  "tags": string[],               // 1-4 of: ${EVENT_TAGS.join(", ")}
  "hasFood": boolean | null
}`;

export function extractEventPrompt(buildings: Building[], text?: string): string {
  return `You turn messy campus event info (a flyer photo, a screenshot or pasted text) into one structured event for San Francisco State University.

${nowLine()}

Campus buildings:
${buildingList(buildings)}

Rules:
- Only use facts that appear in the input. Never invent a time, room or club. Use null for anything missing.
- Match the location to a building id from the list. If nothing matches, use null.
- If the year is missing, pick the next upcoming date.
- "missing" lists the field names that are null and that an organizer must fill in.
- "confidence" is 0 to 1.

${text ? `Pasted text:\n"""\n${text}\n"""\n` : "The event info is in the attached image."}

Reply with only this JSON object, no other text:
{
  "event": ${EVENT_SHAPE},
  "missing": string[],
  "confidence": number
}`;
}

export function checkEventPrompt(
  buildings: Building[],
  event: EventDraft,
  alreadyFound: EventIssue[],
): string {
  return `You review a campus event before it is published on a shared map at San Francisco State University.

${nowLine()}

Campus buildings:
${buildingList(buildings)}

Event:
${JSON.stringify(event, null, 2)}

Dates, times, weekdays and missing fields were already checked by code. These problems were found, do not repeat them:
${alreadyFound.length ? alreadyFound.map((issue) => `- ${issue.field}: ${issue.message}`).join("\n") : "- none"}

Your job:
- "issues": other things a student would find confusing or wrong, such as a title that does not match the description, a description that contradicts the time or place, or an unclear location. Use the event field name. Leave empty if the event looks fine. Never invent a problem.
- "questions": up to 3 short questions to ask the organizer for useful missing info (for example allergens if there is food, whether it is open to all students, or what to bring). Skip anything already answered.

Reply with only this JSON object, no other text:
{
  "issues": [{ "field": string, "message": string }],
  "questions": string[]
}`;
}

export function estimateFoodPrompt(): string {
  return `You look at a photo of leftover food from a campus event so students can claim it before it is thrown away.

Rules:
- "items": a short plain list of what you see, e.g. "Cheese pizza, veggie wraps".
- "portions": a careful estimate of single servings left. When unsure, estimate low.
- "dietary": tags you can actually see evidence for, from: vegetarian, vegan, contains meat, contains dairy, contains gluten, contains nuts, unknown. Use "unknown" when you cannot tell. Never guess that food is free of an allergen.
- "category": "perishable" for anything cooked, hot, cut, dairy, meat or opened. "shelf_stable" only for sealed packaged items like chips, granola bars or canned drinks. When unsure, use "perishable".

Reply with only this JSON object, no other text:
{
  "items": string,
  "portions": number,
  "dietary": string[],
  "category": "perishable" | "shelf_stable"
}`;
}

type AttendedLine = { title: string; clubName: string; tags: string[]; startsAt: string };

function attendedList(events: AttendedLine[]): string {
  return events
    .map(
      (event) =>
        `- ${event.title} (${event.clubName || "no club listed"}; ${event.tags.join(", ") || "no tags"}; ${event.startsAt.slice(0, 10)})`,
    )
    .join("\n");
}

export function profileSummaryPrompt(
  profile: { major: string; gradYear: number | null },
  events: AttendedLine[],
): string {
  return `You write a short profile summary for a San Francisco State University student. It is shown to recruiters only if the student opts in.

The only evidence you have is the list of campus events the student was scanned in to at the door.

Student: ${profile.major || "major not given"}${profile.gradYear ? `, class of ${profile.gradYear}` : ""}

Events they checked in to:
${attendedList(events)}

Rules:
- 2 or 3 sentences, plain language, third person without a name ("Shows up for...", "Has attended...").
- Describe what they show up for and how consistently. Mention specific event types or clubs from the list.
- Never claim a skill, ability, achievement or personality trait. Attendance shows interest, not skill.
- Never mention anything that is not in the list. Do not guess a name, gender or background.
- No hype words.

Reply with only this JSON object, no other text:
{ "summary": string }`;
}

export function eventRecapPrompt(
  event: { title: string; clubName: string; startsAt: string; tags: string[] },
  stats: Record<string, number | null>,
): string {
  return `You write a short recap of a campus event for the club that hosted it at San Francisco State University.

Event: ${event.title} by ${event.clubName || "the host"} on ${event.startsAt.slice(0, 10)} (${event.tags.join(", ") || "no tags"})

Numbers, counted exactly by the system:
${JSON.stringify(stats, null, 2)}

Rules:
- 2 to 4 sentences, plain and useful, written to the club.
- Use only the numbers above, exactly as given. Never estimate or invent a number.
- Write the way a person would, for example "12 of 20 registered students checked in, a 60% turnout". Do not repeat field names.
- Skip anything that is zero unless it is the main point.
- If turnoutPercent is null, nobody registered: say so plainly.
- End with one practical suggestion that follows from the numbers.
- No hype words.

Reply with only this JSON object, no other text:
{ "recap": string }`;
}

export function recruiterSearchPrompt(
  query: string,
  students: {
    profileId: string;
    major: string;
    gradYear: number | null;
    events: (AttendedLine & { eventId: string })[];
  }[],
): string {
  return `A recruiter is looking for San Francisco State University students. Every student below chose to be visible to recruiters. The evidence for each is the list of campus events they were scanned in to.

Recruiter is looking for: "${query}"

Students:
${JSON.stringify(students, null, 2)}

Rules:
- Return the students that fit, best fit first, at most 8. Leave out students with no supporting evidence.
- "reason": one sentence saying which attended events support the match. Attendance shows interest, not skill, so never claim an ability.
- "evidenceEventIds": the eventId values from that student's list that support the match.
- Judge only on major, graduation year and attended events. Never use or guess anything else about a person.
- Use profileId and eventId values exactly as given. Never invent one.
- If nobody fits, return an empty list.

Reply with only this JSON object, no other text:
{ "matches": [{ "profileId": string, "reason": string, "evidenceEventIds": string[] }] }`;
}
