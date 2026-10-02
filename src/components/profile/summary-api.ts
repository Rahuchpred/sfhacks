import { postJson } from "@/lib/api";
import type { ProfileSummaryResponse } from "@/lib/types";

// Asks the server to write a summary for the signed-in student. The server
// reads the student's own check-ins, so nothing is sent from the browser.
export async function writeSummary(): Promise<string> {
  const result = await postJson<ProfileSummaryResponse>("/api/ai/profile-summary");
  if (result.reason === "no_checkins" || !result.summary?.trim()) {
    throw new Error(
      "Nothing to write about yet. Get checked in at an event, then try again.",
    );
  }
  return result.summary.trim();
}
