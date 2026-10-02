// Loads the SFSU class schedule into class_sections and rooms.
// Usage: node --env-file=.env.local scripts/load-classes.mjs [--term 2267] [--all] [--sample] [--dry]
//
// The class search is a public Symfony form. It answers "session expired" unless the
// post carries the session cookie, the hidden _token field and the submit button field
// (which form.submit() in a browser leaves out). With those three a plain request works,
// so no browser is needed. One search with no subject and no building returns the whole
// term, so the script makes four requests in total, a few seconds apart. Walking the
// 139 subjects one by one would return the same rows with 70 times the requests.
//
// The default loads every regular-session class of the term. --all also loads the
// extended learning session (CEL), with one more search.
//
// --sample skips the site and writes generated rows marked sample = true. The script
// also falls back to the sample when the real load fails.
import { createClient } from "@supabase/supabase-js";

const SEARCH_URL = "https://webapps.sfsu.edu/public/classservices/classsearch";
const RESULTS_URL = "https://webapps.sfsu.edu/public/classservices/searchresultsjson";
const USER_AGENT = "GatorRadar class loader (SF Hacks student project)";
const PAUSE_MS = 2500;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

// Building names as the class search prints them, mapped to our buildings.id.
// roomPrefix keeps two real buildings that share one map pin apart.
const BUILDINGS = {
  "Burk Hall": { id: "burk" },
  "Business Building": { id: "business" },
  "Creative Arts Building": { id: "creative-arts" },
  "Creative Arts": { id: "creative-arts" },
  "Ethnic Studies/Psych Bldg": { id: "ethnic-studies" },
  "Fine Arts Building": { id: "fine-arts" },
  Gymnasium: { id: "gym" },
  "HSS Building": { id: "hss" },
  "Hensill Hall": { id: "hensill" },
  "Humanities Building": { id: "humanities" },
  "J.P. Leonard Library": { id: "library" },
  "Mashouf Wellness Center": { id: "mashouf" },
  "Science Building": { id: "science" },
  "Sci & Engr Innov Center": { id: "science", roomPrefix: "SEIC " },
  "Student Services Building": { id: "student-services" },
  "Administration Building": { id: "admin" },
  "Thornton Hall": { id: "thornton" },
};

const DAYS = { Mo: "mon", Tu: "tue", We: "wed", Th: "thu", Fr: "fri", Sa: "sat", Su: "sun" };
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decode(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// "4:00 PM" becomes "16:00".
function to24h(text) {
  const match = text.trim().match(/^(\d{1,2}):(\d\d) ([AP])M$/);
  if (!match) return null;
  const hour = (Number(match[1]) % 12) + (match[3] === "P" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

// "Thornton Hall 335" becomes { buildingId: "thornton", room: "335" }. Places that are
// not on our map keep the full text as the room and get no building.
function parseLocation(text) {
  const location = decode(text);
  const match = location.match(/^(.*?)\s+(\d\S*)(?:\s+-\s+(.*))?$/);
  const building = match ? BUILDINGS[match[1]] : null;
  if (!building) return { buildingId: null, room: location || null };
  const room = `${building.roomPrefix ?? ""}${match[2]}${match[3] ? ` ${match[3]}` : ""}`;
  return { buildingId: building.id, room };
}

// One row of the results table becomes one section row per meeting pattern.
export function parseRow(row, term) {
  const course = decode(row[0].replace(/<[^>]+>/g, "")).match(/^(.+?) (\d\S*) \[(.+?)\]$/);
  if (!course) return [];
  const available = Math.max(Number(row[9]) || 0, 0);
  const enrolled = Number(row[12]) || 0;
  const meetings = [
    ...row[6].matchAll(
      /<div class='row'><div[^>]*>([^<]*)<\/div><div[^>]*>([^<]*)<\/div><div[^>]*>([^<]*)<\/div>/g,
    ),
  ];
  const sections = [];
  for (const [, dayText, timeText, locationText] of meetings) {
    const days = dayText.trim().split(/\s+/).map((day) => DAYS[day]).filter(Boolean);
    const [start, end] = timeText.split(" - ").map(to24h);
    if (days.length === 0 || !start || !end || end <= start) continue;
    sections.push({
      term,
      subject: course[1],
      number: course[2],
      section: course[3],
      class_number: row[4],
      title: decode(row[2]),
      component: row[1],
      ...(({ buildingId, room }) => ({ building_id: buildingId, room }))(parseLocation(locationText)),
      days,
      start_time: start,
      end_time: end,
      starts_on: null,
      ends_on: null,
      enrolled,
      capacity: available + enrolled,
      sample: false,
    });
  }
  return sections;
}

// A room's capacity is the largest class capacity seen in it. Its kind comes from
// the kind of class that meets there most.
export function roomsFrom(sections, sample) {
  const rooms = new Map();
  for (const section of sections) {
    if (!section.building_id || !section.room) continue;
    const key = `${section.building_id}|${section.room}`;
    const room = rooms.get(key) ?? {
      building_id: section.building_id,
      room: section.room,
      capacity: 0,
      components: {},
    };
    room.capacity = Math.max(room.capacity, section.capacity);
    room.components[section.component] = (room.components[section.component] ?? 0) + 1;
    rooms.set(key, room);
  }
  return [...rooms.values()]
    .filter((room) => room.capacity > 0)
    .map(({ components, ...room }) => {
      const top = Object.entries(components).sort((a, b) => b[1] - a[1])[0][0];
      const kind =
        top === "LAB" ? "lab" : top === "ACT" ? "activity" : room.capacity >= 100 ? "lecture_hall" : "classroom";
      return { ...room, kind, sample };
    });
}

class Session {
  cookies = new Map();

  async fetch(url, init = {}) {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
        cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "),
        ...init.headers,
      },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
    const next = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && next) {
      return this.fetch(new URL(next, url).toString());
    }
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return response;
  }
}

// "24-AUG-2026" becomes "2026-08-24".
function isoDate(text) {
  const [day, month, year] = text.split("-");
  return `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}-${day}`;
}

async function loadReal(termWanted) {
  const session = new Session();
  const page = await (await session.fetch(SEARCH_URL)).text();
  const token = page.match(/name="classScheduleAdvanced\[_token\]" value="([^"]+)"/)?.[1];
  const termSelect = page.match(/<select id="classScheduleAdvanced_term"[^>]*>(.*?)<\/select>/s)?.[1];
  const terms = [...(termSelect ?? "").matchAll(/<option value="(\d+)"[^>]*>([^<]+)/g)];
  if (!token || terms.length === 0) throw new Error("The search form changed: token or term list not found.");
  const [, term, termName] = terms.find(([, value]) => value === termWanted) ?? terms[0];
  console.log(`Term ${term} (${termName}).`);

  const rows = [];
  for (const category of flag("--all") ? ["REG", "CEL"] : ["REG"]) {
    await sleep(PAUSE_MS);
    const form = new URLSearchParams({
      "classScheduleAdvanced[term]": term,
      "classScheduleAdvanced[termClassCategory]": `${term}:${category}`,
      "classScheduleAdvanced[subject]": "X",
      "classScheduleAdvanced[categoryNumber]": "",
      "classScheduleAdvanced[startTime]": "",
      "classScheduleAdvanced[endTime]": "",
      "classScheduleAdvanced[location]": "",
      "classScheduleAdvanced[instructorLastName]": "",
      "classScheduleAdvanced[courseAttributes]": "",
      "classScheduleAdvanced[courseAttributes2]": "",
      "classScheduleAdvanced[submit]": "",
      "classScheduleAdvanced[_token]": token,
    });
    const results = await (
      await session.fetch(SEARCH_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", referer: SEARCH_URL },
        body: form,
      })
    ).text();
    if (/session has been expired/i.test(results) || !results.includes("searchresultsjson")) {
      throw new Error("The search was refused (session expired or no results page).");
    }

    await sleep(PAUSE_MS);
    const json = await (
      await session.fetch(RESULTS_URL, { headers: { "x-requested-with": "XMLHttpRequest" } })
    ).json();
    console.log(`${category}: ${json.aaData?.length ?? 0} sections.`);
    rows.push(...(json.aaData ?? []));
  }
  const sections = rows.flatMap((row) => parseRow(row, term));
  if (sections.length < 100) throw new Error(`Only ${sections.length} sections parsed from ${rows.length} rows.`);

  // The first and last day of instruction are only on the detail page. One full-term
  // lecture gives the dates for the term.
  let dates = null;
  const lecture = rows.find((row) => row[1] === "LEC" && row[6].includes(" - "));
  const detailPath = lecture?.[0].match(/href="([^"]+)"/)?.[1];
  if (detailPath) {
    await sleep(PAUSE_MS);
    try {
      const detail = await (await session.fetch(new URL(detailPath, SEARCH_URL).toString())).text();
      const match = detail.match(/(\d\d-[A-Z]{3}-\d{4})\s*-\s*(\d\d-[A-Z]{3}-\d{4})/);
      if (match) dates = { starts_on: isoDate(match[1]), ends_on: isoDate(match[2]) };
    } catch (error) {
      console.log(`Term dates not read: ${error.message}`);
    }
  }
  console.log(dates ? `Instruction runs ${dates.starts_on} to ${dates.ends_on}.` : "Term dates unknown.");
  if (dates) for (const section of sections) Object.assign(section, dates);

  return { term, rows: rows.length, sections, rooms: roomsFrom(sections, false), sample: false };
}

// A small deterministic generator, so the sample is the same on every run.
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Sample data: made up, shaped like the real schedule. Every row is marked sample.
function buildSample() {
  const next = random(2267);
  const pick = (list) => list[Math.floor(next() * list.length)];
  const home = {
    thornton: ["CSC", "MATH", "PHYS"],
    hensill: ["BIOL", "CHEM"],
    science: ["ENGR", "BIOL"],
    business: ["BUS", "MKTG", "FIN", "ACCT"],
    hss: ["PSY", "SOC", "ECON"],
    humanities: ["ENG", "HIST", "PHIL"],
    burk: ["CAD", "COMM", "KIN"],
    "fine-arts": ["ART", "DES"],
    "creative-arts": ["MUS", "CINE"],
    "ethnic-studies": ["ETHS", "PSY"],
    library: ["ENG"],
    gym: ["KIN"],
  };
  const patterns = [["mon", "wed"], ["tue", "thu"], ["mon", "wed", "fri"], ["mon"], ["tue"], ["wed"], ["thu"], ["fri"]];
  const starts = ["08:00", "09:30", "11:00", "12:30", "14:00", "15:30", "16:00", "17:30", "19:00"];
  const sections = [];
  for (const [buildingId, subjects] of Object.entries(home)) {
    const roomCount = buildingId === "library" || buildingId === "gym" ? 3 : 10;
    for (let index = 0; index < roomCount; index++) {
      const room = String(100 * (1 + Math.floor(index / 4)) + 10 + index * 3);
      const capacity = pick([24, 30, 35, 40, 45, 60, 120]);
      const used = new Set();
      for (let count = 0; count < 9; count++) {
        const days = pick(patterns);
        const start = pick(starts);
        if (days.some((day) => used.has(day + start))) continue;
        for (const day of days) used.add(day + start);
        const [hour, minute] = start.split(":").map(Number);
        const length = days.length === 1 ? 165 : days.length === 2 ? 75 : 50;
        const end = hour * 60 + minute + length;
        const subject = pick(subjects);
        const number = String(100 + Math.floor(next() * 600));
        sections.push({
          term: "sample",
          subject,
          number,
          section: "01",
          class_number: null,
          title: `Sample ${subject} ${number}`,
          component: "LEC",
          building_id: buildingId,
          room,
          days,
          start_time: start,
          end_time: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
          starts_on: null,
          ends_on: null,
          enrolled: Math.round(capacity * (0.5 + next() * 0.5)),
          capacity,
          sample: true,
        });
      }
    }
  }
  return { term: "sample", rows: sections.length, sections, rooms: roomsFrom(sections, true), sample: true };
}

async function save(data) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const check = (label, { error }) => {
    if (error) throw new Error(`${label}: ${error.message}`);
  };
  // Both tables hold only what this script wrote, so a load replaces them whole.
  check("clear sections", await supabase.from("class_sections").delete().not("id", "is", null));
  check("clear rooms", await supabase.from("rooms").delete().not("id", "is", null));
  for (let index = 0; index < data.sections.length; index += 500) {
    check("insert sections", await supabase.from("class_sections").insert(data.sections.slice(index, index + 500)));
  }
  check("insert rooms", await supabase.from("rooms").insert(data.rooms));
}

function summary(data) {
  const subjects = new Set(data.sections.map((section) => section.subject));
  const mapped = data.sections.filter((section) => section.building_id);
  const buildings = new Set(mapped.map((section) => section.building_id));
  return (
    `${data.sample ? "SAMPLE data" : "Real schedule"}, term ${data.term}: ${data.sections.length} meeting rows ` +
    `from ${data.rows} sections, ${subjects.size} subjects, ${mapped.length} rows in ${buildings.size} of our buildings, ` +
    `${data.rooms.length} rooms.`
  );
}

async function main() {
  let data;
  if (flag("--sample")) {
    data = buildSample();
  } else {
    try {
      data = await loadReal(option("--term"));
    } catch (error) {
      console.log(`Real schedule not loaded: ${error.message}`);
      console.log("Falling back to generated sample data.");
      data = buildSample();
    }
  }
  console.log(summary(data));
  if (flag("--dry")) return;
  await save(data);
  console.log("Saved to class_sections and rooms.");
}

// Runs only as a script, so the parsers above can be imported and tested.
if (process.argv[1]?.endsWith("load-classes.mjs")) await main();
