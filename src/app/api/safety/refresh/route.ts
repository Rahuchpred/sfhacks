import { createClient } from "@supabase/supabase-js";
import { aiErrorResponse, generateJson } from "@/lib/ai";
import { safetyNoticesSchema } from "@/lib/ai-schemas";
import type { Database } from "@/lib/database.types";
import { listBuildings } from "@/lib/db";
import { safetyNoticesFixture } from "@/lib/fixtures";
import { safetyNoticesPrompt } from "@/lib/prompts";

const SOURCE_URL = "https://upd.sfsu.edu/timely-warnings-0";

function pageText(html: string): string {
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html;
  return main
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 30_000);
}

// Reads the University Police timely warnings page and stores each warning as
// a neutral notice. This is the only way a safety notice gets into the app.
export async function POST() {
  try {
    const page = await fetch(SOURCE_URL, { headers: { "user-agent": "GatorRadar/1.0 (student project)" } });
    if (!page.ok) {
      return Response.json({ error: `Could not read the police page (${page.status}).` }, { status: 502 });
    }
    const buildings = await listBuildings();
    const result = await generateJson({
      prompt: safetyNoticesPrompt(buildings, pageText(await page.text())),
      schema: safetyNoticesSchema,
      fixture: safetyNoticesFixture,
    });

    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const rows = result.notices.map((notice) => {
      const buildingId = buildings.some((building) => building.id === notice.buildingId)
        ? notice.buildingId
        : null;
      const occurredOn = /^\d{4}-\d{2}-\d{2}$/.test(notice.occurredOn ?? "") ? notice.occurredOn : null;
      return {
        source_key: `${notice.title}|${occurredOn ?? ""}`.toLowerCase(),
        source_url: SOURCE_URL,
        category: notice.category,
        title: notice.title,
        summary: notice.summary,
        area: notice.area,
        building_id: buildingId,
        // Sensitive notices are listed but never pinned to a place.
        show_pin: !notice.sensitive && buildingId !== null,
        occurred_on: occurredOn,
        fetched_at: new Date().toISOString(),
      };
    });
    if (rows.length > 0) {
      const { error } = await admin.from("safety_notices").upsert(rows, { onConflict: "source_key" });
      if (error) throw error;
    }
    return Response.json({ stored: rows.length });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
