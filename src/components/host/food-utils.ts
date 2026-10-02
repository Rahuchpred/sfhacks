// Small helpers for the leftover food page: pickup codes, safe-until times, the AI call.

export const GOLD_BUTTON = "bg-accent text-accent-foreground hover:bg-accent/85";

export const PICKUP_CODE_LENGTH = 4;

// Pickup codes are 4 uppercase letters and digits. Drop anything else a phone
// keyboard adds (spaces, dashes, dots), then uppercase.
export function normalizePickupCode(raw: string): string {
  return raw
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, PICKUP_CODE_LENGTH);
}

export const LIMIT_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

// Shown as chips. Tags from the AI estimate that are not here are added next to them.
export const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "halal",
  "kosher",
  "gluten-free",
  "contains nuts",
  "contains dairy",
];

// What a model writes when it cannot tell. Not a tag a student can use.
const NOT_A_TAG = new Set(["unknown", "none", "n/a", "unsure"]);

export function cleanTags(tags: string[]): string[] {
  const cleaned = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag && !NOT_A_TAG.has(tag));
  return [...new Set(cleaned)];
}

const STEP_MS = 15 * 60 * 1000;
// Sealed food is safe for about 8 hours, so 12 hours of choices covers every estimate.
const SAFE_WINDOW_STEPS = 48;

const clockFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export type TimeOption = { value: string; label: string };

// Every quarter hour from now for the next 12 hours, as ISO values.
export function safeTimeOptions(now: number): TimeOption[] {
  const first = Math.ceil((now + 60_000) / STEP_MS) * STEP_MS;
  const today = new Date(now).toDateString();
  return Array.from({ length: SAFE_WINDOW_STEPS }, (_, index) => {
    const date = new Date(first + index * STEP_MS);
    const clock = clockFormat.format(date);
    return {
      value: date.toISOString(),
      label: date.toDateString() === today ? clock : `Tomorrow, ${clock}`,
    };
  });
}

// The option closest to the AI's time without going past it. Rounding down is the safe side.
export function snapToOption(iso: string, options: TimeOption[]): string {
  const target = Date.parse(iso);
  if (Number.isNaN(target) || options.length === 0) return "";
  let picked = options[0].value;
  for (const option of options) {
    if (Date.parse(option.value) <= target) picked = option.value;
    else break;
  }
  return picked;
}

// "9:41" style countdown for a 15 minute hold.
export function formatHold(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// POSTs JSON to an AI route. Throws with the route's own error message.
export async function postJson<Req, Res>(url: string, body: Req, signal?: AbortSignal): Promise<Res> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed (${response.status}).`);
  }
  return data as Res;
}
