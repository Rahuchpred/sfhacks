// Prompt builders. Starter versions: Thread B owns and improves these.
import { EVENT_TAGS, FOOD_OPTIONS, TIMEZONE } from "@/lib/checks";
import { REWARD_TYPES, type Building, type EventDraft, type EventIssue } from "@/lib/types";

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
  "hasFood": boolean | null,
  "foodItems": string[]            // only food the input names, from: ${FOOD_OPTIONS.join(", ")}
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

export function hostInsightsPrompt(stats: unknown): string {
  return `You help a student club at San Francisco State University learn from its event data. Everything below was counted exactly by the system. There are no names in it.

Data:
${JSON.stringify(stats, null, 2)}

Rules:
- "insights": 3 to 5 findings a club officer could act on. Each has a short "title" (2 to 5 words) and a "detail" of one or two plain sentences that quotes the specific numbers behind it.
- Look for: which events, weekdays or times drew the best turnout, the gap between sign-ups and check-ins, which majors or years show up and which are missing, whether food changes turnout, how much food was left over, and cost per attendee.
- If leftover food is consistent, say how much less to order next time, using the leftover numbers.
- Describe patterns, not causes. With this few events, say "events with food drew more check-ins", never "food increases attendance".
- Use only the numbers given. Never invent or estimate a number. If the data is too thin to support a finding (for example one event), say so plainly instead of guessing.
- "nextEvent": one concrete suggestion for the next event (day, time, food amount or audience), with the reason.
- No hype words.

Reply with only this JSON object, no other text:
{ "insights": [{ "title": string, "detail": string }], "nextEvent": string }`;
}

export function structureHelpPrompt(buildings: Building[], text: string): string {
  return `A faculty or staff member at San Francisco State University wants a student's help with a one-time task. Turn their words into a clear request that a student can understand in ten seconds.

Campus buildings:
${buildingList(buildings)}

What they wrote:
"""
${text}
"""

Rules:
- "title": 4 to 9 words, starting with a verb, saying what the student will do.
- "description": 2 or 3 plain sentences on the task and why it matters. Use only what they wrote.
- "timeNeeded": how long it takes in plain words, or "" if they did not say.
- "skills": 0 to 4 short skills the task needs, only ones the text implies.
- "rewardType": what the student gets, one of: ${REWARD_TYPES.join(", ")}. Use null if the text does not say. Never assume one.
- "rewardDetail": one sentence on what the student gets, or "" if not said.
- "buildingId": an id from the list if a place is named, otherwise null.
- Never invent a detail.

Reply with only this JSON object, no other text:
{
  "title": string,
  "description": string,
  "timeNeeded": string,
  "skills": string[],
  "rewardType": string | null,
  "rewardDetail": string,
  "buildingId": string | null
}`;
}

export function safetyNoticesPrompt(buildings: Building[], pageText: string): string {
  return `Below is the text of the San Francisco State University Police "Timely Warnings" web page. Extract each individual warning into a short, neutral notice for a campus map.

Campus buildings:
${buildingList(buildings)}

Page text:
"""
${pageText}
"""

Rules:
- One entry per warning. Skip the general introduction and the general safety tips.
- "title": the warning's own heading, without the date.
- "category": a short plain type, for example "Robbery", "Burglary", "Sexual assault", "Aggravated assault".
- "occurredOn": the date of the incident as YYYY-MM-DD, or null.
- "area": the general place in a few words (a building name or a street), exactly as the notice gives it.
- "buildingId": an id from the list only if the notice names that building, otherwise null.
- "summary": one or two neutral sentences on what kind of incident happened, where and when, and what University Police are doing.
- The summary must NOT describe any person: no clothing, appearance, race, age or gender of a suspect, and nothing about the victim beyond "a community member". Leave out graphic detail.
- "sensitive": true for sexual assault, sexual battery, stalking, domestic or dating violence, and anything inside a residence hall. Otherwise false.
- For a sensitive notice, the summary and "area" must not name a building, street or route. Say only "on campus" or "near campus".
- Use only what the page says. Never invent a detail.

Reply with only this JSON object, no other text:
{ "notices": [{ "title": string, "category": string, "occurredOn": string | null, "area": string, "buildingId": string | null, "summary": string, "sensitive": boolean }] }`;
}
