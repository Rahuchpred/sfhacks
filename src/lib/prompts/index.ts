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
