// Prompt builders. Starter versions: Thread B owns and improves these.
import type { Building, EventDraft } from "@/lib/types";

const TIMEZONE = "America/Los_Angeles";

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
  "tags": string[],               // 1-4 of: social, cultural, academic, career, sports, arts, wellness, volunteer, free food
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

export function checkEventPrompt(buildings: Building[], event: EventDraft): string {
  return `You check a campus event before it is published on a shared map at San Francisco State University. Find real problems only.

${nowLine()}

Campus buildings:
${buildingList(buildings)}

Event:
${JSON.stringify(event, null, 2)}

Check for:
- A weekday named in the title or description that does not match the date
- A start time in the past, or an end time before the start time
- A missing building, room, start or end time
- A buildingId that is not in the list
- An event with food but no mention of allergens

"issues" use severity "error" for things that block publishing and "warn" for things worth a second look. "questions" are short questions to ask the organizer for missing info. "ok" is true only when there are no errors.

Reply with only this JSON object, no other text:
{
  "ok": boolean,
  "issues": [{ "field": string, "message": string, "severity": "error" | "warn" }],
  "questions": string[]
}`;
}

export function estimateFoodPrompt(postedAt: string): string {
  return `You look at a photo of leftover food from a campus event so students can claim it before it is thrown away.

The photo was posted at ${postedAt}.

Rules:
- "items": a short plain list of what you see, e.g. "Cheese pizza, veggie wraps".
- "portions": a careful estimate of single servings left. When unsure, estimate low.
- "dietary": tags you can actually see evidence for, from: vegetarian, vegan, contains meat, contains dairy, contains gluten, contains nuts, halal, unknown. Use "unknown" when you cannot tell.
- "safeUntil": ISO 8601 time. Hot or perishable food left out is safe for 2 hours after posting. Packaged shelf-stable food is safe for 8 hours.
- "note": one short sentence explaining the safe-until time.
- Never guess that food is free of an allergen.

Reply with only this JSON object, no other text:
{
  "items": string,
  "portions": number,
  "dietary": string[],
  "safeUntil": string,
  "note": string
}`;
}
