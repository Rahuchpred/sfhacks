// Runs saved inputs through the AI routes and prints pass or fail per case.
// Usage: npm run eval   (the dev server must be running on port 3600)
const BASE = process.env.EVAL_BASE_URL ?? "http://localhost:3600";

const day = (offsetDays, hour) => {
  const date = new Date(Date.now() + offsetDays * 86400_000);
  date.setHours(hour, 0, 0, 0);
  return date;
};
const weekdayOf = (date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "long" }).format(date);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const soon = day(3, 17);
const soonEnd = day(3, 19);
const wrongDay = WEEKDAYS[(WEEKDAYS.indexOf(weekdayOf(soon)) + 1) % 7];

const base = {
  title: "Game Night",
  description: "Board games for everyone.",
  clubName: "Board Game Club",
  buildingId: "cesar-chavez",
  room: "T-160",
  startsAt: soon.toISOString(),
  endsAt: soonEnd.toISOString(),
  tags: ["social"],
  hasFood: false,
};

const hasError = (res, field) =>
  res.issues.some((issue) => issue.field === field && issue.severity === "error");
const hasWarn = (res, field) =>
  res.issues.some((issue) => issue.field === field && issue.severity === "warn");

const checkCases = [
  ["clean event passes", base, (r) => r.ok === true],
  [
    "wrong weekday blocks",
    { ...base, title: `${wrongDay} Game Night` },
    (r) => !r.ok && hasError(r, "startsAt"),
  ],
  [
    "right weekday passes",
    { ...base, title: `${weekdayOf(soon)} Game Night` },
    (r) => r.ok === true,
  ],
  [
    "ended event blocks",
    { ...base, startsAt: day(-1, 17).toISOString(), endsAt: day(-1, 19).toISOString() },
    (r) => !r.ok && hasError(r, "startsAt"),
  ],
  [
    "event happening now passes",
    { ...base, startsAt: new Date(Date.now() - 3600_000).toISOString(), endsAt: new Date(Date.now() + 3600_000).toISOString() },
    (r) => r.ok === true,
  ],
  ["end before start blocks", { ...base, endsAt: day(3, 15).toISOString() }, (r) => !r.ok && hasError(r, "endsAt")],
  ["missing room only warns", { ...base, room: null }, (r) => r.ok === true && hasWarn(r, "room")],
  ["unknown building blocks", { ...base, buildingId: "hogwarts" }, (r) => !r.ok && hasError(r, "buildingId")],
  ["missing start blocks", { ...base, startsAt: null }, (r) => !r.ok && hasError(r, "startsAt")],
  [
    "food without allergen info warns",
    { ...base, hasFood: true, description: "Free pizza for all." },
    (r) => r.ok === true && hasWarn(r, "description"),
  ],
];

const extractCases = [
  [
    "messy text with room and time",
    "yo CS club is doing a study night w/ free pizza!! next tuesday 6-9pm in the library rm 121. bring ur laptop",
    (r) =>
      r.event.buildingId === "library" &&
      r.event.room?.includes("121") &&
      r.event.hasFood === true &&
      weekdayOf(new Date(r.event.startsAt)) === "Tuesday" &&
      r.event.tags.includes("free food"),
  ],
  [
    "alias resolves to building",
    "Resume workshop by Career Services, HSS 210, Oct 14 2026 from 2pm to 3:30pm",
    (r) => r.event.buildingId === "hss" && r.event.room?.includes("210") && r.event.startsAt?.startsWith("2026-10-14"),
  ],
  [
    "missing time stays null",
    "Come hang out with the Photography Club on the Quad sometime next week!",
    (r) => r.event.startsAt === null && r.missing.includes("startsAt") && r.event.buildingId === "quad",
  ],
  [
    "unknown place is not invented",
    "Film Club screening at the Balboa Theatre on Oct 20 2026 at 7pm",
    (r) => r.event.buildingId === null && r.missing.includes("buildingId"),
  ],
  [
    "no food is not assumed",
    "Yoga for beginners at the Mashouf Wellness Center, Oct 12 2026, 9am-10am. Mats provided.",
    (r) => r.event.buildingId === "mashouf" && r.event.hasFood !== true && !r.event.tags.includes("free food"),
  ],
];

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

let failed = 0;
async function run(group, path, cases, toBody) {
  console.log(`\n${group}`);
  for (const [name, input, expect] of cases) {
    let result;
    let pass = false;
    try {
      result = await post(path, toBody(input));
      pass = Boolean(expect(result));
    } catch (error) {
      result = { thrown: String(error) };
    }
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) {
      failed++;
      console.log(`        ${JSON.stringify(result).slice(0, 400)}`);
    }
  }
}

await run("check-event", "/api/ai/check-event", checkCases, (event) => ({ event }));
await run("extract-event", "/api/ai/extract-event", extractCases, (text) => ({ text }));

console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
