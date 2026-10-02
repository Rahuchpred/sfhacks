// Runs saved inputs through the AI routes and prints pass or fail per case.
// Usage: npm run eval   (the dev server must be running on port 3600)
// The planner math cases call src/lib/planner.ts directly and need no server:
// node scripts/eval.mjs --math
import * as planner from "../src/lib/planner.ts";

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
  ["missing room is fine", { ...base, room: null }, (r) => r.ok === true && r.issues.length === 0],
  ["unknown building blocks", { ...base, buildingId: "hogwarts" }, (r) => !r.ok && hasError(r, "buildingId")],
  ["missing start blocks", { ...base, startsAt: null }, (r) => !r.ok && hasError(r, "startsAt")],
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
  return { status: res.status, ...(await res.json()) };
}

// Planner math: fixed inputs, exact answers ---------------------------------

const NOW = Date.parse("2026-10-02T19:00:00Z");
const at = (date, minute) => planner.campusToIso(date, minute);
const slot = (date, from, to) => ({ startsAt: at(date, from), endsAt: at(date, to) });
// 2026-10-05 is a Monday.
const MON = "2026-10-05";
const TUE = "2026-10-06";

const pastEvent = (checkedIn, daysAgo, extra = {}) => ({
  id: `p${daysAgo}`,
  clubId: "club-a",
  tags: ["academic"],
  buildingId: "thornton",
  startsAt: at(planner.addDays("2026-10-02", -daysAgo), 17 * 60),
  checkedIn,
  ...extra,
});
const steady = [38, 40, 42, 36, 41, 39].map((count, index) => pastEvent(count, 7 * (index + 1)));
const target = { clubId: "club-a", tags: ["academic"], buildingId: "thornton", startsAt: at(MON, 17 * 60), hasFood: false };

const section = (extra = {}) => ({
  classNumber: "1",
  subject: "CSC",
  number: "413",
  title: "Software Development",
  buildingId: "thornton",
  room: "335",
  days: ["mon"],
  startMinute: 16 * 60,
  endMinute: 17 * 60 + 15,
  startsOn: "2026-08-24",
  endsOn: "2026-12-11",
  enrolled: 25,
  ...extra,
});
const rooms = [
  { buildingId: "thornton", room: "335", capacity: 40, kind: "classroom" },
  { buildingId: "thornton", room: "210", capacity: 30, kind: "classroom" },
  { buildingId: "hensill", room: "101", capacity: 120, kind: "lecture_hall" },
  { buildingId: "hensill", room: "220", capacity: 60, kind: "lab" },
];
// CSC has 100 seats in all: the 25 in room 335 and 75 on Tuesday.
const sections = [
  section(),
  section({ classNumber: "2", number: "210", title: "Intro", room: "210", days: ["tue"], enrolled: 75 }),
];
const campus = planner.buildCampus(rooms, sections);
const csAudience = [{ major: "Computer Science", attendees: 10 }];
const clashAt = (window, context = {}) =>
  planner.findClashes(campus, [], window, { tags: ["academic"], audience: null, ...context });
const otherEvent = (title, tags, extra = {}) => ({
  id: title,
  title,
  clubId: null,
  buildingId: "library",
  room: null,
  ...slot(MON, 18 * 60, 19 * 60),
  tags,
  rsvpCount: 12,
  ...extra,
});
const planInput = {
  campus,
  events: [],
  past: steady,
  buildingNames: new Map([["thornton", "Thornton Hall"], ["hensill", "Hensill Hall"]]),
  target: { clubId: "club-a", tags: ["academic"], hasFood: false },
  audience: csAudience,
  now: NOW,
};
const facts = {
  day: "Monday, Oct 5",
  time: "5:30 PM to 7:00 PM",
  building: "Thornton Hall",
  room: "210",
  capacity: 30,
  expectedPeople: 39,
  clashes: [],
  audienceInClassPercent: 0,
  campusInClassPercent: 12,
  studentsAroundPercent: 40,
};

const mathCases = [
  [
    "no history: says so and stays low",
    () => planner.forecastTurnout(target, [], NOW),
    (f) => f.basedOn === 0 && f.confidence === "low" && f.expected === 20 && /No past check-ins/.test(f.reason),
  ],
  [
    "no history: the host's estimate is used, nothing is invented",
    () => planner.forecastTurnout({ ...target, hostEstimate: 40 }, [], NOW),
    (f) => f.basedOn === 0 && f.expected === 40 && f.confidence === "low" && f.low < 40 && f.high > 40,
  ],
  [
    "six steady club events: high confidence",
    () => planner.forecastTurnout(target, steady, NOW),
    (f) => f.basedOn === 6 && f.expected === 39 && f.confidence === "high" && f.low === 31 && f.high === 47,
  ],
  [
    "one club event: low confidence, wide range",
    () => planner.forecastTurnout(target, [pastEvent(30, 7)], NOW),
    (f) => f.basedOn === 1 && f.expected === 30 && f.confidence === "low" && f.low === 15 && f.high === 45,
  ],
  [
    "another club's events with the same tag: fallback, never high",
    () => planner.forecastTurnout({ ...target, clubId: "club-b" }, steady, NOW),
    (f) => f.basedOn === 6 && f.confidence === "medium" && /same tag/.test(f.reason),
  ],
  [
    "no club, no tag, other building: any event, low",
    () => planner.forecastTurnout({ ...target, clubId: null, tags: ["sports"], buildingId: "gym" }, steady, NOW),
    (f) => f.basedOn === 6 && f.confidence === "low",
  ],
  [
    "events with zero check-ins are not history",
    () => planner.forecastTurnout(target, [pastEvent(0, 7), pastEvent(0, 14)], NOW),
    (f) => f.basedOn === 0,
  ],
  [
    "future events are not history",
    () => planner.forecastTurnout(target, [pastEvent(50, -3)], NOW),
    (f) => f.basedOn === 0,
  ],
  [
    "food: portions are expected plus 10 percent",
    () => planner.forecastTurnout({ ...target, hasFood: true }, steady, NOW),
    (f) => f.food.portions === 43 && /11 large pizzas/.test(f.food.suggestion),
  ],
  ["no food: no portions", () => planner.forecastTurnout(target, steady, NOW), (f) => f.food === null],
  [
    "campus time survives the end of daylight saving",
    () => [at("2026-10-30", 16 * 60), at("2026-11-02", 16 * 60), planner.campusTime("2026-11-03T00:00:00Z")],
    ([pdt, pst, back]) =>
      pdt === "2026-10-30T23:00:00.000Z" &&
      pst === "2026-11-03T00:00:00.000Z" &&
      back.date === "2026-11-02" &&
      back.minute === 960 &&
      back.weekday === "mon",
  ],
  [
    "room is taken during its class",
    () => planner.isRoomFree(campus, [], "thornton", "335", slot(MON, 16 * 60 + 30, 18 * 60)),
    (free) => free === false,
  ],
  [
    "room is taken in the ten minutes after class",
    () => planner.isRoomFree(campus, [], "thornton", "335", slot(MON, 17 * 60 + 20, 18 * 60)),
    (free) => free === false,
  ],
  [
    "room is free once the class has left",
    () => planner.isRoomFree(campus, [], "thornton", "Room 335", slot(MON, 17 * 60 + 30, 19 * 60)),
    (free) => free === true,
  ],
  [
    "room is free on a day the class does not meet",
    () => planner.isRoomFree(campus, [], "thornton", "335", slot(TUE, 16 * 60, 18 * 60)),
    (free) => free === true,
  ],
  [
    "room is free after the last day of instruction",
    () => planner.isRoomFree(campus, [], "thornton", "335", slot("2026-12-14", 16 * 60, 18 * 60)),
    (free) => free === true,
  ],
  [
    "an event in the room takes it",
    () =>
      planner.isRoomFree(
        campus,
        [otherEvent("Other", [], { buildingId: "thornton", room: "rm 210" })],
        "thornton",
        "210",
        slot(MON, 18 * 60 + 30, 20 * 60),
      ),
    (free) => free === false,
  ],
  [
    "free rooms: big enough, bookable, smallest first",
    () => planner.findFreeRooms(campus, [], slot(MON, 16 * 60, 17 * 60), 25),
    (list) => list.map((room) => room.room).join() === "210,101",
  ],
  [
    "class clash share: 2 classes x 25 of 100 seats = 50%",
    () => clashAt(slot(MON, 16 * 60, 17 * 60), { audience: csAudience }),
    (r) =>
      r.audienceBusy === 0.5 &&
      r.clashes[0].kind === "class" &&
      r.clashes[0].audienceShare === 0.5 &&
      r.clashes[0].label === "CSC 413 Software Development",
  ],
  [
    "half the audience in another major halves the share",
    () => clashAt(slot(MON, 16 * 60, 17 * 60), { audience: [...csAudience, { major: "Dance", attendees: 10 }] }),
    (r) => r.audienceBusy === 0.25,
  ],
  [
    "no class at that hour: nobody busy",
    () => clashAt(slot(MON, 18 * 60, 19 * 60), { audience: csAudience }),
    (r) => r.audienceBusy === 0 && r.clashes.length === 0,
  ],
  [
    "unknown audience: share is null, never guessed",
    () => clashAt(slot(MON, 16 * 60, 17 * 60)),
    (r) => r.audienceBusy === null && r.clashes.every((clash) => clash.audienceShare === null),
  ],
  [
    "two attendees are too few to call an audience",
    () => clashAt(slot(MON, 16 * 60, 17 * 60), { audience: [{ major: "Computer Science", attendees: 2 }] }),
    (r) => r.audienceBusy === null,
  ],
  [
    "a class in the chosen room is a clash",
    () => clashAt(slot(MON, 16 * 60, 17 * 60), { buildingId: "thornton", room: "335" }),
    (r) => r.roomTaken && /uses room 335/.test(r.clashes[0].note),
  ],
  [
    "an event with a shared tag is a clash, another tag is not",
    () =>
      planner.findClashes(
        campus,
        [otherEvent("Study Jam", ["academic"]), otherEvent("Yoga", ["wellness"])],
        slot(MON, 18 * 60, 19 * 60),
        { tags: ["academic", "free food"], audience: null },
      ),
    (r) => r.eventClashes === 1 && r.clashes.length === 1 && r.clashes[0].label === "Study Jam",
  ],
  [
    "a taken room scores 50 lower",
    () => {
      const clash = { ...clashAt(slot(MON, 18 * 60, 19 * 60)), presence: 1 };
      const input = { forecastShare: 1, capacity: 40, needed: 30 };
      return [planner.scoreSlot({ clash, ...input }), planner.scoreSlot({ clash: { ...clash, roomTaken: true }, ...input })];
    },
    ([free, taken]) => free - taken === 50,
  ],
  [
    "plan: only real, free, big enough rooms, best first",
    () =>
      planner.planOptions({
        ...planInput,
        constraints: planner.resolveConstraints({ dateFrom: MON, dateTo: MON, earliestHour: 15, latestHour: 20 }, 90, NOW),
        expectedPeople: 28,
      }),
    (options) =>
      options.length > 0 &&
      options.length <= 3 &&
      options.every(
        (option, index) =>
          rooms.some(
            (room) =>
              room.buildingId === option.buildingId &&
              room.room === option.room &&
              room.capacity === option.capacity &&
              room.kind !== "lab",
          ) &&
          option.capacity >= 47 &&
          planner.isRoomFree(campus, [], option.buildingId, option.room, option) &&
          (index === 0 || options[index - 1].score >= option.score),
      ),
  ],
  [
    "plan: nothing fits, no option is made up",
    () =>
      planner.planOptions({
        ...planInput,
        constraints: planner.resolveConstraints({ dateFrom: MON, dateTo: MON }, 90, NOW),
        expectedPeople: 500,
      }),
    (options) => options.length === 0,
  ],
  [
    "time wish: impossible dates and hours fall back to safe bounds",
    () => planner.resolveConstraints({ dateFrom: "2020-01-01", dateTo: "2031-01-01", earliestHour: 99 }, 5000, NOW),
    (c) =>
      c.dates[0] >= "2026-10-03" &&
      c.dates.at(-1) <= "2026-12-01" &&
      c.earliestMinute === 600 &&
      c.durationMinutes === 480,
  ],
  [
    "time wish: one named day stays one day",
    () => planner.resolveConstraints({ dateFrom: "2026-10-10" }, 60, NOW),
    (c) => c.dates.join() === "2026-10-10",
  ],
  [
    "check: a class in the room gives better slots in free rooms",
    () => planner.checkSlot({ ...planInput, buildingId: "thornton", room: "335", window: slot(MON, 16 * 60, 17 * 60) }),
    (r) =>
      r.clashes.length > 0 &&
      r.betterSlots.length > 0 &&
      r.betterSlots.every(
        (option) => option.score > r.score && planner.isRoomFree(campus, [], option.buildingId, option.room, option),
      ),
  ],
  [
    "check: a clear slot gets no better slots",
    () =>
      planner.checkSlot({
        ...planInput,
        audience: null,
        buildingId: "thornton",
        room: "210",
        window: slot(TUE, 17 * 60 + 30, 18 * 60 + 30),
      }),
    (r) => r.clashes.length === 0 && r.betterSlots.length === 0,
  ],
  [
    "AI reason that uses only the facts is kept",
    () => planner.reasonUsesOnlyFacts("Room 210 seats 30 and only 12% of campus is in class.", facts),
    (ok) => ok === true,
  ],
  [
    "AI reason with a number of its own is rejected",
    () => planner.reasonUsesOnlyFacts("Expect 55 people in room 210.", facts),
    (ok) => ok === false,
  ],
];

// Planner routes -------------------------------------------------------------

// The next Wednesday on the campus calendar. CSC 413 meets in Thornton 335 from 4:00 PM.
let nextWed = planner.addDays(planner.campusTime(Date.now()).date, 1);
while (new Date(`${nextWed}T12:00:00Z`).getUTCDay() !== 3) nextWed = planner.addDays(nextWed, 1);
const checkBody = {
  tags: ["academic"],
  buildingId: "thornton",
  room: "335",
  ...slot(nextWed, 16 * 60, 17 * 60 + 30),
  hasFood: true,
};
const hourOf = (iso) => planner.campusTime(iso).minute / 60;
const sane = (f) =>
  f.low <= f.expected && f.expected <= f.high && ["low", "medium", "high"].includes(f.confidence) && f.basedOn >= 0;

const plannerCheckCases = [
  [
    "room with a class: clash found, better slots offered",
    checkBody,
    (r) =>
      r.clashes.some((clash) => clash.kind === "class" && /uses room 335/.test(clash.note)) &&
      r.betterSlots.length > 0 &&
      r.betterSlots.length <= 3 &&
      r.betterSlots.every((option) => option.buildingId === "thornton" && option.capacity > 0) &&
      sane(r.forecast) &&
      r.forecast.food.portions >= r.forecast.expected,
  ],
  [
    "building without room data still gets a forecast",
    { ...checkBody, buildingId: "cesar-chavez", room: "Jack Adams Hall", hasFood: false },
    (r) =>
      sane(r.forecast) &&
      r.forecast.food === null &&
      Array.isArray(r.clashes) &&
      r.betterSlots.every((option) => option.capacity === 0),
  ],
  [
    "unknown club id: no audience share is invented",
    { ...checkBody, clubId: "00000000-0000-0000-0000-000000000000" },
    (r) => r.clashes.length > 0 && r.clashes.every((clash) => clash.audienceShare === null),
  ],
  ["unknown building is refused", { ...checkBody, buildingId: "hogwarts" }, (r) => r.status === 400],
  ["end before start is refused", { ...checkBody, endsAt: checkBody.startsAt }, (r) => r.status === 400],
];

// Every option must be a real room with a code-made score and a reason without dashes.
const realPlace = (r) =>
  r.options.length <= 3 &&
  r.options.every(
    (option) =>
      option.capacity > 0 &&
      option.room &&
      option.buildingName &&
      option.score >= 0 &&
      option.score <= 100 &&
      option.reason.length > 0 &&
      !/[\u2013\u2014]/.test(option.reason),
  );

const planCases = [
  [
    "full idea: people, food, length and time wish",
    "ok so we're the computer science club and uh we want to do an intro to machine learning workshop next week sometime after 4pm, probably like 40 people, we'll get pizza, it should run an hour and a half",
    (r) =>
      r.idea.expectedPeople === 40 &&
      r.idea.hasFood === true &&
      r.idea.durationMinutes === 90 &&
      r.idea.tags.includes("academic") &&
      r.idea.tags.includes("free food") &&
      r.options.length > 0 &&
      realPlace(r) &&
      r.options.every((option) => hourOf(option.startsAt) >= 16 && option.capacity >= 40) &&
      r.forecast.food !== null &&
      sane(r.forecast) &&
      r.source.classSections > 1000,
  ],
  [
    "no number said: none invented, no food assumed",
    "we want to host a board game night for our club, just a chill social thing, two hours",
    (r) =>
      r.idea.expectedPeople === null &&
      r.idea.hasFood === false &&
      !r.idea.tags.includes("free food") &&
      r.idea.durationMinutes === 120 &&
      r.idea.tags.includes("social") &&
      r.forecast.food === null &&
      realPlace(r),
  ],
  [
    "weekday and morning are respected",
    "Resume review session on a Friday morning, one hour, around 15 students",
    (r) =>
      r.idea.expectedPeople === 15 &&
      r.idea.durationMinutes === 60 &&
      r.idea.tags.includes("career") &&
      r.options.length > 0 &&
      realPlace(r) &&
      r.options.every((option) => planner.campusTime(option.startsAt).weekday === "fri" && hourOf(option.endsAt) <= 12),
  ],
  [
    "a place off campus does not become a room, the day and hour hold",
    "Film club screening at the Balboa Theatre next Thursday at 7pm with popcorn for 60 people",
    (r) =>
      r.idea.expectedPeople === 60 &&
      r.idea.hasFood === true &&
      realPlace(r) &&
      r.options.every(
        (option) =>
          planner.campusTime(option.startsAt).weekday === "thu" &&
          hourOf(option.startsAt) >= 19 &&
          option.capacity >= 60,
      ),
  ],
  ["empty transcript is refused", "  ", (r) => r.status === 400],
];

let failed = 0;
function runMath(group, cases) {
  console.log(`\n${group}`);
  for (const [name, compute, expect] of cases) {
    let result;
    let pass = false;
    try {
      result = compute();
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

runMath("planner math", mathCases);
if (!process.argv.includes("--math")) {
  await run("check-event", "/api/ai/check-event", checkCases, (event) => ({ event }));
  await run("extract-event", "/api/ai/extract-event", extractCases, (text) => ({ text }));
  await run("planner/check", "/api/planner/check", plannerCheckCases, (body) => body);
  await run("plan-event", "/api/ai/plan-event", planCases, (transcript) => ({ transcript }));
}

console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
