// SAMPLE data for demos: fake students, two clubs, past, live and upcoming events,
// registrations, door check-ins and leftover food. None of it is real.
//
// Add:    node --env-file=.env.local scripts/seed-demo.mjs owner@example.com [other@example.com]
// Remove: node --env-file=.env.local scripts/seed-demo.mjs --remove
//
// The listed accounts become owners of both clubs, and get a few check-ins and a ticket
// of their own. Sample students use emails that start with "sample.", and sample clubs
// are named in CLUBS below, so everything can be found and removed again.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const EMAIL_PREFIX = "sample.";
const FOOD_PHOTO = "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=70";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function check(label, { error }) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

// A small fixed random source, so every run gives the same data.
let seed = 20261002;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const FIRST = [
  "Aaliyah", "Mateo", "Priya", "Jamal", "Sofia", "Kenji", "Fatima", "Diego", "Mei", "Andre",
  "Yuki", "Camila", "Omar", "Hana", "Lucas", "Amara", "Ravi", "Isabella", "Tuan", "Zoe",
  "Carlos", "Nia", "Arjun", "Elena", "Malik", "Linh", "Gabriel", "Leila", "Noah", "Ximena",
  "Darius", "Aiko", "Samir", "Valeria", "Ethan", "Thandi", "Minh", "Rosa", "Kai", "Layla",
  "Javier", "Sana", "Tyler", "Ngozi", "Hiro", "Daniela", "Yusuf", "Chloe", "Bao", "Imani",
  "Rafael", "Anika", "Jordan", "Paloma", "Kwame", "Sara", "Emre", "Lucia", "Dev", "Maya",
];
const LAST = [
  "Nguyen", "Garcia", "Patel", "Johnson", "Martinez", "Tanaka", "Hassan", "Lopez", "Chen", "Williams",
  "Kim", "Rodriguez", "Ali", "Sato", "Silva", "Okafor", "Sharma", "Rossi", "Tran", "Brown",
  "Hernandez", "Jackson", "Singh", "Petrova", "Davis", "Pham", "Santos", "Ahmadi", "Miller", "Flores",
];

// Majors lean toward what each club draws, so the analytics have something to show.
const MAJORS = [
  ["Computer Science", 16],
  ["Computer Engineering", 5],
  ["Mathematics", 4],
  ["Business Administration", 7],
  ["Design", 7],
  ["Art", 4],
  ["Biology", 5],
  ["Psychology", 5],
  ["Communication Studies", 3],
  ["Cinema", 2],
  ["Nursing", 2],
];
const TECH = new Set(["Computer Science", "Computer Engineering", "Mathematics"]);
const CREATIVE = new Set(["Design", "Art", "Cinema", "Communication Studies"]);

const CLUBS = ["Gator Coders", "SF State Design Collective"];

// Days from today (negative is the past), Pacific start hour, minutes long.
const EVENTS = [
  // Gator Coders
  { club: 0, title: "Intro to Git and GitHub", day: -42, hour: 17, mins: 90, building: "thornton", room: "429", tags: ["academic"], going: 34, came: 26, cost: 0 },
  { club: 0, title: "LeetCode Night with Pizza", day: -35, hour: 17, mins: 120, building: "thornton", room: "429", tags: ["academic", "free food"], food: ["pizza"], going: 52, came: 44, cost: 180, leftovers: { items: "Pepperoni and cheese pizza", portions: 12, claimed: 10 } },
  { club: 0, title: "Resume Review with Alumni Engineers", day: -28, hour: 16, mins: 90, building: "library", room: "121", tags: ["career"], going: 41, came: 29, cost: 40 },
  { club: 0, title: "Build Your First API", day: -21, hour: 17, mins: 120, building: "thornton", room: "429", tags: ["academic"], going: 38, came: 31, cost: 0 },
  { club: 0, title: "Hack Night: Boba and Side Projects", day: -14, hour: 18, mins: 150, building: "cesar-chavez", room: "Rosa Parks A-C", tags: ["social", "free food"], food: ["boba", "chips and snacks"], going: 60, came: 51, cost: 260, leftovers: { items: "Boba milk tea and chips", portions: 15, claimed: 15 } },
  { club: 0, title: "Machine Learning Study Jam", day: -7, hour: 12, mins: 75, building: "library", room: "121", tags: ["academic"], going: 30, came: 17, cost: 0 },
  { club: 0, title: "Mock Technical Interviews", day: -3, hour: 17, mins: 120, building: "thornton", room: "429", tags: ["career", "free food"], food: ["sandwiches"], going: 46, came: 39, cost: 150, leftovers: { items: "Turkey and veggie sandwiches", portions: 8, claimed: 5 } },
  { club: 0, title: "Open Lab: Bring Your Bug", live: true, mins: 150, building: "thornton", room: "429", tags: ["academic", "free food"], food: ["pizza", "coffee"], going: 37, came: 22, cost: 120, leftovers: { items: "Veggie pizza and cold brew", portions: 10, claimed: 3, open: true } },
  { club: 0, title: "Intro to React Workshop", day: 4, hour: 17, mins: 120, building: "thornton", room: "429", tags: ["academic", "free food"], food: ["pizza"], going: 28, came: 0, cost: 160 },
  { club: 0, title: "Tech Career Panel", day: 11, hour: 16, mins: 90, building: "library", room: "121", tags: ["career"], going: 19, came: 0, cost: 0 },
  // SF State Design Collective
  { club: 1, title: "Figma Basics", day: -30, hour: 15, mins: 90, building: "fine-arts", room: "293", tags: ["arts", "academic"], going: 27, came: 21, cost: 0 },
  { club: 1, title: "Portfolio Critique Night", day: -16, hour: 17, mins: 120, building: "fine-arts", room: "293", tags: ["arts", "career", "free food"], food: ["donuts", "coffee"], going: 33, came: 24, cost: 85, leftovers: { items: "Assorted donuts", portions: 9, claimed: 7 } },
  { club: 1, title: "Poster Printing Social", day: -5, hour: 13, mins: 90, building: "cesar-chavez", room: "Terrace Level", tags: ["arts", "social"], going: 22, came: 18, cost: 60 },
  { club: 1, title: "Design Sprint: Campus Wayfinding", day: 6, hour: 14, mins: 180, building: "fine-arts", room: "293", tags: ["arts", "academic"], going: 16, came: 0, cost: 0 },
];

async function allUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function remove() {
  const { data: clubs, error } = await supabase.from("clubs").select("id").in("name", CLUBS);
  if (error) throw new Error(`find clubs: ${error.message}`);
  const clubIds = clubs.map((club) => club.id);
  if (clubIds.length > 0) {
    const { data: events } = await supabase.from("events").select("id").in("club_id", clubIds);
    const eventIds = (events ?? []).map((event) => event.id);
    if (eventIds.length > 0) {
      check("remove food", await supabase.from("food_rescues").delete().in("event_id", eventIds));
      check("remove events", await supabase.from("events").delete().in("id", eventIds));
    }
    check("remove clubs", await supabase.from("clubs").delete().in("id", clubIds));
  }
  const samples = (await allUsers()).filter((user) => user.email?.startsWith(EMAIL_PREFIX));
  for (const user of samples) {
    const { error: userError } = await supabase.auth.admin.deleteUser(user.id);
    if (userError) throw new Error(`remove ${user.email}: ${userError.message}`);
  }
  return { clubs: clubIds.length, students: samples.length };
}

// Pacific time is UTC-7 during the fall term.
function startOf(event, now) {
  if (event.live) return new Date(now - 40 * 60_000);
  const start = new Date(now + event.day * DAY);
  start.setUTCHours(event.hour + 7, 0, 0, 0);
  return start;
}

const removed = await remove();
if (process.argv.includes("--remove")) {
  console.log(`Removed ${removed.clubs} sample clubs and ${removed.students} sample students.`);
  process.exit(0);
}

const ownerEmails = process.argv.slice(2).filter((arg) => arg.includes("@"));
if (ownerEmails.length === 0) {
  console.error("Usage: node --env-file=.env.local scripts/seed-demo.mjs owner@example.com");
  process.exit(1);
}
const users = await allUsers();
const owners = ownerEmails.map((email) => {
  const user = users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`No account for ${email}. Sign in once first, or run demo-admin.mjs.`);
  return user.id;
});

// Students ---------------------------------------------------------------
const majorPool = MAJORS.flatMap(([major, count]) => Array(count).fill(major));
const students = [];
for (let i = 0; i < majorPool.length; i += 1) {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7 + 3) % LAST.length];
  const email = `${EMAIL_PREFIX}${first}.${last}${i}@sfsu.edu`.toLowerCase();
  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw new Error(`create ${email}: ${error.message}`);
  const major = majorPool[i];
  students.push({
    id: data.user.id,
    full_name: `${first} ${last}`,
    major,
    grad_year: pick([2027, 2027, 2028, 2028, 2029, 2030]),
    bio: `${major} student at SF State.`,
    role: "student",
    recruiter_visible: random() < 0.6,
  });
}
check("profiles", await supabase.from("profiles").upsert(students));

// Clubs ------------------------------------------------------------------
const clubIds = [];
for (const name of CLUBS) {
  const { data, error } = await supabase
    .from("clubs")
    .insert({ name, created_by: owners[0] })
    .select("id")
    .single();
  if (error) throw new Error(`club ${name}: ${error.message}`);
  clubIds.push(data.id);
  check(
    "club owners",
    await supabase
      .from("club_members")
      .upsert(owners.map((uid, index) => ({ club_id: data.id, uid, role: index === 0 ? "owner" : "organizer" }))),
  );
  check("club invite", await supabase.from("club_invites").upsert({ club_id: data.id }));
}

// Events, registrations, check-ins and food ---------------------------------
const now = Date.now();
let registrations = 0;
let checkIns = 0;
for (const [index, event] of EVENTS.entries()) {
  const start = startOf(event, now);
  const end = new Date(start.getTime() + event.mins * 60_000);
  const { data: row, error } = await supabase
    .from("events")
    .insert({
      title: event.title,
      description: `${CLUBS[event.club]} event. Sample data for the demo.`,
      club_name: CLUBS[event.club],
      club_id: clubIds[event.club],
      building_id: event.building,
      room: event.room,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      tags: event.tags,
      has_food: Boolean(event.food),
      food_items: event.food ?? [],
      cost: event.cost,
      source: "organizer",
      created_by: owners[0],
      rsvp_count: event.going,
      checked_in_count: event.came,
    })
    .select("id")
    .single();
  if (error) throw new Error(`event ${event.title}: ${error.message}`);

  // Each club mostly draws its own majors, with some guests from everywhere.
  const home = event.club === 0 ? TECH : CREATIVE;
  const fans = shuffled(students.filter((student) => home.has(student.major)));
  const others = shuffled(students.filter((student) => !home.has(student.major)));
  const fromHome = Math.min(fans.length, Math.round(event.going * 0.7));
  const guests = [...fans.slice(0, fromHome), ...others.slice(0, event.going - fromHome)];
  // The owner accounts attended three past events and hold a ticket for one upcoming one.
  const ownerGoes = [1, 4, 6, 8].includes(index);
  const rows = guests.slice(0, ownerGoes ? event.going - owners.length : event.going).map((student, place) => ({
    event_id: row.id,
    uid: student.id,
    created_at: new Date(start.getTime() - (1 + random() * 6) * DAY).toISOString(),
    checked_in_at:
      place < event.came
        ? new Date(start.getTime() + (random() * 25 - 5) * 60_000).toISOString()
        : null,
  }));
  if (ownerGoes) {
    for (const uid of owners) {
      rows.push({
        event_id: row.id,
        uid,
        created_at: new Date(start.getTime() - 2 * DAY).toISOString(),
        checked_in_at: event.came > 0 ? new Date(start.getTime() + 4 * 60_000).toISOString() : null,
      });
    }
  }
  check(`rsvps for ${event.title}`, await supabase.from("rsvps").insert(rows));
  registrations += rows.length;
  checkIns += rows.filter((item) => item.checked_in_at).length;

  if (event.leftovers) {
    const left = event.leftovers;
    const posted = new Date(Math.min(end.getTime() - 20 * 60_000, now - 5 * 60_000));
    const { data: rescue, error: rescueError } = await supabase
      .from("food_rescues")
      .insert({
        event_id: row.id,
        building_id: event.building,
        room: event.room,
        photo_url: FOOD_PHOTO,
        items: left.items,
        portions: left.portions,
        portions_left: left.portions - left.claimed,
        safe_until: new Date(left.open ? now + 2 * HOUR : posted.getTime() + 2 * HOUR).toISOString(),
        status: left.open ? "open" : left.claimed === left.portions ? "gone" : "expired",
        created_by: owners[0],
        created_at: posted.toISOString(),
      })
      .select("id")
      .single();
    if (rescueError) throw new Error(`food for ${event.title}: ${rescueError.message}`);
    const takers = shuffled(guests).slice(0, left.claimed);
    check(
      `claims for ${event.title}`,
      await supabase.from("claims").insert(
        takers.map((student) => {
          const at = new Date(posted.getTime() + random() * 20 * 60_000);
          return {
            rescue_id: rescue.id,
            uid: student.id,
            created_at: at.toISOString(),
            expires_at: new Date(at.getTime() + 15 * 60_000).toISOString(),
            picked_up_at: new Date(at.getTime() + 6 * 60_000).toISOString(),
          };
        }),
      ),
    );
  }
}

console.log(
  `Added ${students.length} sample students, ${CLUBS.length} clubs, ${EVENTS.length} events, ` +
    `${registrations} registrations and ${checkIns} check-ins.`,
);
