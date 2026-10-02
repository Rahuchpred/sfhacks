// SAMPLE attendance history for trying the planner forecast. Not real data.
// The real database has almost no past check-ins, so without this the forecast
// honestly answers "no past check-ins yet".
//
// Add:    node --env-file=.env.local scripts/seed-planner-history.mjs
// Remove: node --env-file=.env.local scripts/seed-planner-history.mjs --remove
//
// Every row is named "ZZ4 B ..." so it is easy to find and remove. The events are in
// the past, so they never show on the map. They do count as campus history for every
// club's forecast while they exist, so remove them before showing real numbers.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const PREFIX = "ZZ4 B";
const NOBODY = "00000000-0000-0000-0000-000000000000";

function check(label, { error }) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function remove() {
  check("remove events", await supabase.from("events").delete().like("title", `${PREFIX} %`));
  check("remove club", await supabase.from("clubs").delete().like("name", `${PREFIX} %`));
}

// Weeks ago, start hour (UTC offset ignored: a rough evening or afternoon), check-ins.
const history = [
  { weeks: 1, hour: 17, checkedIn: 41, registered: 55, tags: ["academic", "free food"], food: true },
  { weeks: 2, hour: 17, checkedIn: 36, registered: 48, tags: ["academic"], food: false },
  { weeks: 3, hour: 16, checkedIn: 44, registered: 60, tags: ["academic", "career"], food: true },
  { weeks: 4, hour: 17, checkedIn: 38, registered: 50, tags: ["academic"], food: false },
  { weeks: 5, hour: 18, checkedIn: 33, registered: 47, tags: ["social", "free food"], food: true },
  { weeks: 6, hour: 17, checkedIn: 40, registered: 52, tags: ["academic"], food: false },
];

await remove();
if (process.argv.includes("--remove")) {
  console.log("Removed the sample planner history.");
} else {
  const { data: club, error } = await supabase
    .from("clubs")
    .insert({ name: `${PREFIX} Sample Club`, created_by: NOBODY })
    .select()
    .single();
  if (error) throw new Error(`club: ${error.message}`);

  const rows = history.map((event, index) => {
    // Thursdays at the given Pacific hour (UTC-7 during the fall term).
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 3) % 7) - 7 * event.weeks);
    start.setUTCHours(event.hour + 7, 0, 0, 0);
    return {
      title: `${PREFIX} Sample meetup ${index + 1}`,
      description: "Sample history for the planner forecast.",
      club_name: club.name,
      club_id: club.id,
      building_id: "thornton",
      room: "429",
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 90 * 60_000).toISOString(),
      tags: event.tags,
      has_food: event.food,
      source: "seed",
      rsvp_count: event.registered,
      checked_in_count: event.checkedIn,
    };
  });
  check("insert events", await supabase.from("events").insert(rows));
  console.log(`Added ${rows.length} sample past events for club ${club.id} (${club.name}).`);
}
