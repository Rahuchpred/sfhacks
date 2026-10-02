import type { Profile, TicketWithEvent } from "@/lib/types";
import { attendanceStats } from "@/components/profile/profile-utils";

// Asks the server to write a summary for the signed-in student.
// Request body is empty: the server reads the signed-in user.
export async function writeSummary(
  profile: Profile,
  attended: TicketWithEvent[],
): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/ai/profile-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    // STUB: delete this fallback when /api/ai/profile-summary exists.
    return stubSummary(profile, attended);
  }

  if (response.status === 404) {
    // STUB: delete this fallback when /api/ai/profile-summary exists.
    return stubSummary(profile, attended);
  }

  const data: unknown = await response.json().catch(() => null);
  const body = (data ?? {}) as { summary?: unknown; error?: unknown };
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Could not write a summary.");
  }
  if (typeof body.summary !== "string" || !body.summary.trim()) {
    throw new Error("The summary came back empty. Try again.");
  }
  return body.summary.trim();
}

// STUB: a local stand-in for the AI route, built from real profile and attendance data only.
// Delete this function (and both fallbacks above) when /api/ai/profile-summary exists.
function stubSummary(profile: Profile, attended: TicketWithEvent[]): string {
  const stats = attendanceStats(attended);
  const name = profile.fullName.trim() || "This student";

  const study = [
    profile.major.trim() ? `studies ${profile.major.trim()}` : "is a student",
    "at SF State",
    profile.gradYear ? `(class of ${profile.gradYear})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const bio = profile.bio.trim();
  const first = `${name} ${study}.${bio ? ` ${/[.!?]$/.test(bio) ? bio : `${bio}.`}` : ""}`;

  if (stats.events === 0) return first;

  const events = `${stats.events} campus event${stats.events === 1 ? "" : "s"}`;
  const clubs = `${stats.clubs} club${stats.clubs === 1 ? "" : "s"}`;
  const tags = stats.topTags.length > 0 ? `, mostly around ${listWords(stats.topTags)}` : "";
  return `${first} They have shown up to ${events} hosted by ${clubs}${tags}.`;
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
