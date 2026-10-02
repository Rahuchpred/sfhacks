// Event planner math: turnout forecast, free rooms, clashes and slot ranking.
// Plain code with no AI and no database, so every number can be traced and tested.
// Only type imports here: scripts/eval.mjs loads this file directly with node.
import type { Clash, Confidence, Forecast, PlanOption } from "@/lib/planner-types";

const TIMEZONE = "America/Los_Angeles";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_NAMES: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};
const MINUTE = 60_000;

// ---------------------------------------------------------------------------
// Inputs

export type PastEvent = {
  id: string;
  clubId: string | null;
  tags: string[];
  buildingId: string;
  startsAt: string;
  checkedIn: number;
};

export type PlannerRoom = {
  buildingId: string;
  room: string;
  capacity: number;
  kind: string;
};

export type ClassSection = {
  classNumber: string | null;
  subject: string;
  number: string;
  title: string;
  buildingId: string | null;
  room: string | null;
  days: string[];
  // Minutes after midnight, campus time.
  startMinute: number;
  endMinute: number;
  startsOn: string | null;
  endsOn: string | null;
  enrolled: number;
};

export type OtherEvent = {
  id: string;
  title: string;
  clubId: string | null;
  buildingId: string;
  room: string | null;
  startsAt: string;
  endsAt: string;
  tags: string[];
  rsvpCount: number;
};

// Past attendees of a club, counted per major. Null when we do not know them.
export type Audience = { major: string; attendees: number }[] | null;

export type Window = { startsAt: string; endsAt: string };

// ---------------------------------------------------------------------------
// Campus time

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

export type CampusTime = { date: string; weekday: string; minute: number };

// An instant as the campus clock shows it.
export function campusTime(iso: string | number | Date): CampusTime {
  const parts: Record<string, string> = {};
  for (const part of partsFormat.formatToParts(new Date(iso))) parts[part.type] = part.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday.toLowerCase().slice(0, 3),
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// The instant for a campus date ("2026-10-08") and minutes after midnight.
export function campusToIso(date: string, minute: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day, 0, minute);
  // What the campus clock shows at the guess tells us the offset to remove.
  const shown = campusTime(guess);
  const [shownYear, shownMonth, shownDay] = shown.date.split("-").map(Number);
  const shownUtc = Date.UTC(shownYear, shownMonth - 1, shownDay, 0, shown.minute);
  return new Date(guess - (shownUtc - guess)).toISOString();
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekdayOfDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return DAY_KEYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function clock(minute: number): string {
  const hour = Math.floor(minute / 60);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute % 60).padStart(2, "0")} ${suffix}`;
}

type Span = { date: string; weekday: string; start: number; end: number };

// The window on the campus clock. A window that runs past midnight is cut at midnight.
function spanOf(window: Window): Span {
  const start = campusTime(window.startsAt);
  const length = Math.max(Math.round((Date.parse(window.endsAt) - Date.parse(window.startsAt)) / MINUTE), 1);
  return {
    date: start.date,
    weekday: start.weekday,
    start: start.minute,
    end: Math.min(start.minute + length, 1440),
  };
}

// ---------------------------------------------------------------------------
// Forecast

// Used only when there is no history and the host gave no estimate.
const STARTING_GUESS = 20;
const PORTION_BUFFER = 1.1;

export type ForecastTarget = {
  clubId?: string | null;
  tags: string[];
  buildingId?: string | null;
  startsAt: string;
  hasFood: boolean;
  // The host's own estimate, used only when there is no history.
  hostEstimate?: number | null;
};

function foodFor(expected: number, hasFood: boolean): Forecast["food"] {
  if (!hasFood) return null;
  const portions = Math.max(Math.ceil(expected * PORTION_BUFFER), 1);
  // Two slices each, eight slices in a large pizza.
  const pizzas = Math.ceil((portions * 2) / 8);
  return {
    portions,
    suggestion: `Plan ${portions} portions, about ${pizzas} large ${pizzas === 1 ? "pizza" : "pizzas"}.`,
  };
}

// Expected check-ins from past events that had door check-in. The closest history
// wins: the club's own events, then events with a shared tag, then the same building,
// then any event. With no history it says so and never makes one up.
export function forecastTurnout(target: ForecastTarget, past: PastEvent[], now: number = Date.now()): Forecast {
  const history = past
    .filter((event) => event.checkedIn > 0 && Date.parse(event.startsAt) < now)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const wantedTags = target.tags.filter((tag) => tag !== "free food");

  const tiers: { events: PastEvent[]; label: (count: number) => string; trust: number }[] = [
    {
      events: target.clubId ? history.filter((event) => event.clubId === target.clubId).slice(0, 12) : [],
      label: (count) => (count === 1 ? "Your last event" : `Your last ${count} events`),
      trust: 2,
    },
    {
      events: history.filter((event) => event.tags.some((tag) => wantedTags.includes(tag))),
      label: (count) => `${count} past campus ${count === 1 ? "event" : "events"} with the same tag`,
      trust: 1,
    },
    {
      events: history.filter((event) => event.buildingId === target.buildingId),
      label: (count) => `${count} past ${count === 1 ? "event" : "events"} in this building`,
      trust: 0,
    },
    {
      events: history,
      label: (count) => `${count} past campus ${count === 1 ? "event" : "events"}`,
      trust: 0,
    },
  ];
  const tier = tiers.find((candidate) => candidate.events.length > 0);

  if (!tier) {
    const guess = target.hostEstimate && target.hostEstimate > 0 ? Math.round(target.hostEstimate) : null;
    const expected = guess ?? STARTING_GUESS;
    return {
      expected,
      low: Math.max(Math.round(expected * 0.4), 1),
      high: Math.round(expected * (guess ? 1.4 : 2)),
      confidence: "low",
      basedOn: 0,
      reason: guess
        ? "No past check-ins yet, so this is your own estimate."
        : "No past check-ins yet. This is a rough starting guess.",
      food: foodFor(expected, target.hasFood),
    };
  }

  // Events on the same weekday and near the same hour count a bit more.
  const wanted = campusTime(target.startsAt);
  const weights = tier.events.map((event) => {
    const time = campusTime(event.startsAt);
    return (
      1 +
      (time.weekday === wanted.weekday ? 0.5 : 0) +
      (Math.abs(time.minute - wanted.minute) <= 120 ? 0.5 : 0) +
      (tier.trust < 2 && event.buildingId === target.buildingId ? 0.5 : 0)
    );
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const mean = tier.events.reduce((sum, event, index) => sum + event.checkedIn * weights[index], 0) / totalWeight;
  const variance =
    tier.events.reduce((sum, event, index) => sum + weights[index] * (event.checkedIn - mean) ** 2, 0) / totalWeight;
  const count = tier.events.length;

  // The range is never tighter than this share of the mean. Less history, wider range.
  const minSpread = count >= 6 ? 0.2 : count >= 3 ? 0.3 : 0.5;
  const spread = Math.max(Math.sqrt(variance), mean * minSpread);
  const steady = Math.sqrt(variance) <= mean * 0.35;

  let confidence: Confidence = "low";
  if (tier.trust === 2 && count >= 5 && steady) confidence = "high";
  else if ((tier.trust === 2 && count >= 3) || (tier.trust === 1 && count >= 5)) confidence = "medium";

  const expected = Math.max(Math.round(mean), 1);
  return {
    expected,
    low: Math.max(Math.round(mean - spread), 1),
    high: Math.max(Math.round(mean + spread), expected),
    confidence,
    basedOn: count,
    reason: `${tier.label(count)} drew ${expected}${count === 1 ? "" : " on average"}.`,
    food: foodFor(expected, target.hasFood),
  };
}

// ---------------------------------------------------------------------------
// Campus index

const BUCKET = 30;
const BUCKETS = 1440 / BUCKET;

export type Campus = {
  rooms: PlannerRoom[];
  buildingsWithRooms: Set<string>;
  // Sections by weekday, and by weekday and room.
  byDay: Map<string, ClassSection[]>;
  byDayRoom: Map<string, ClassSection[]>;
  // Students in class per weekday and half hour: everyone, and those in a campus room.
  busy: Map<string, number[]>;
  onCampus: Map<string, number[]>;
  peakBusy: number;
  peakOnCampus: number;
  // First and last day of instruction over all sections. Null when unknown.
  termStart: string | null;
  termEnd: string | null;
  // Enrolled seats per subject, each section counted once.
  subjectSeats: Map<string, number>;
};

function roomKey(buildingId: string, room: string): string {
  return `${buildingId}|${normalizeRoom(room)}`;
}

// "Room 429" and "429" are the same room.
export function normalizeRoom(room: string): string {
  return room.toLowerCase().replace(/\b(room|rm)\b\.?/g, "").replace(/\s+/g, " ").trim();
}

export function buildCampus(rooms: PlannerRoom[], sections: ClassSection[]): Campus {
  const byDay = new Map<string, ClassSection[]>();
  const byDayRoom = new Map<string, ClassSection[]>();
  const busy = new Map<string, number[]>();
  const onCampus = new Map<string, number[]>();
  const subjectSeats = new Map<string, number>();
  const counted = new Set<string>();

  for (const section of sections) {
    const id = section.classNumber ?? `${section.subject}|${section.number}|${section.startMinute}|${section.room}`;
    if (!counted.has(id)) {
      counted.add(id);
      subjectSeats.set(section.subject, (subjectSeats.get(section.subject) ?? 0) + section.enrolled);
    }
    for (const day of section.days) {
      byDay.set(day, [...(byDay.get(day) ?? []), section]);
      if (section.buildingId && section.room) {
        const key = `${day}|${roomKey(section.buildingId, section.room)}`;
        byDayRoom.set(key, [...(byDayRoom.get(key) ?? []), section]);
      }
      if (!busy.has(day)) {
        busy.set(day, new Array(BUCKETS).fill(0));
        onCampus.set(day, new Array(BUCKETS).fill(0));
      }
      const first = Math.floor(section.startMinute / BUCKET);
      const last = Math.min(Math.ceil(section.endMinute / BUCKET), BUCKETS);
      for (let bucket = first; bucket < last; bucket++) {
        busy.get(day)![bucket] += section.enrolled;
        if (section.buildingId) onCampus.get(day)![bucket] += section.enrolled;
      }
    }
  }

  const peak = (table: Map<string, number[]>) => Math.max(0, ...[...table.values()].flat());
  return {
    rooms,
    buildingsWithRooms: new Set(rooms.map((room) => room.buildingId)),
    byDay,
    byDayRoom,
    busy,
    onCampus,
    peakBusy: peak(busy),
    peakOnCampus: peak(onCampus),
    termStart: sections.reduce<string | null>((first, s) => (s.startsOn && (!first || s.startsOn < first) ? s.startsOn : first), null),
    termEnd: sections.reduce<string | null>((last, s) => (s.endsOn && (!last || s.endsOn > last) ? s.endsOn : last), null),
    subjectSeats,
  };
}

function inTerm(section: ClassSection, date: string): boolean {
  if (section.startsOn && date < section.startsOn) return false;
  if (section.endsOn && date > section.endsOn) return false;
  return true;
}

function meets(section: ClassSection, span: Span, buffer = 0): boolean {
  return (
    inTerm(section, span.date) &&
    section.startMinute < span.end + buffer &&
    section.endMinute > span.start - buffer
  );
}

// Classes only meet between the first and the last day of instruction.
function inSession(campus: Campus, date: string): boolean {
  return !(campus.termStart && date < campus.termStart) && !(campus.termEnd && date > campus.termEnd);
}

function overlaps(event: Window, window: Window): boolean {
  return Date.parse(event.startsAt) < Date.parse(window.endsAt) && Date.parse(event.endsAt) > Date.parse(window.startsAt);
}

// Share of the busiest half hour of the week: how many students are in class
// at some point of the window. 0 when no class meets then.
export function campusLoad(campus: Campus, window: Window): number {
  const span = spanOf(window);
  const table = campus.busy.get(span.weekday);
  if (!table || campus.peakBusy === 0 || !inSession(campus, span.date)) return 0;
  let most = 0;
  for (let bucket = Math.floor(span.start / BUCKET); bucket < Math.ceil(span.end / BUCKET); bucket++) {
    most = Math.max(most, table[bucket] ?? 0);
  }
  return most / campus.peakBusy;
}

// Share of the busiest half hour: how many students have a class on campus in the
// hour before or the hour after the window, so they are around and could come.
// Null when there is no schedule to tell (nothing loaded, or outside the term).
export function campusPresence(campus: Campus, window: Window): number | null {
  const span = spanOf(window);
  if (campus.peakOnCampus === 0 || !inSession(campus, span.date)) return null;
  const table = campus.onCampus.get(span.weekday);
  if (!table) return 0;
  const before = [span.start - 60, span.start - 30].map((minute) => table[Math.floor(minute / BUCKET)] ?? 0);
  const after = [span.end, span.end + 30].map((minute) => table[Math.floor(minute / BUCKET)] ?? 0);
  return (Math.max(...before) + Math.max(...after)) / 2 / campus.peakOnCampus;
}

// ---------------------------------------------------------------------------
// Free rooms

// Time kept free around a class so the room can empty and fill.
const PASSING_MINUTES = 10;
const BOOKABLE_KINDS = ["classroom", "lecture_hall"];

export function classInRoom(campus: Campus, buildingId: string, room: string, window: Window): ClassSection | null {
  const span = spanOf(window);
  const sections = campus.byDayRoom.get(`${span.weekday}|${roomKey(buildingId, room)}`) ?? [];
  return sections.find((section) => meets(section, span, PASSING_MINUTES)) ?? null;
}

function eventInRoom(events: OtherEvent[], buildingId: string, room: string, window: Window): OtherEvent | null {
  const wanted = normalizeRoom(room);
  return (
    events.find(
      (event) =>
        event.buildingId === buildingId &&
        event.room !== null &&
        normalizeRoom(event.room) === wanted &&
        overlaps(event, window),
    ) ?? null
  );
}

// A room is free when no class section and no event uses it in the window.
export function isRoomFree(campus: Campus, events: OtherEvent[], buildingId: string, room: string, window: Window): boolean {
  return !classInRoom(campus, buildingId, room, window) && !eventInRoom(events, buildingId, room, window);
}

// Free classrooms and lecture halls that hold at least minCapacity, smallest first.
export function findFreeRooms(
  campus: Campus,
  events: OtherEvent[],
  window: Window,
  minCapacity: number,
  buildingId?: string | null,
): PlannerRoom[] {
  return campus.rooms
    .filter(
      (room) =>
        BOOKABLE_KINDS.includes(room.kind) &&
        room.capacity >= minCapacity &&
        (!buildingId || room.buildingId === buildingId) &&
        isRoomFree(campus, events, room.buildingId, room.room, window),
    )
    .sort((a, b) => a.capacity - b.capacity || a.room.localeCompare(b.room));
}

// ---------------------------------------------------------------------------
// Clashes

// Which class subjects a major takes. The first subject is the major's own.
export const MAJOR_SUBJECTS: Record<string, string[]> = {
  Accounting: ["ACCT", "BUS"],
  Anthropology: ["ANTH"],
  "Apparel Design and Merchandising": ["ADM"],
  Art: ["ART", "ARTH"],
  "Asian American Studies": ["AA S"],
  Biochemistry: ["CHEM", "BIOL"],
  Biology: ["BIOL", "CHEM"],
  "Broadcast and Electronic Communication Arts": ["BECA"],
  "Business Administration": ["BUS", "MGMT", "MKTG", "FIN", "ACCT", "DS", "ISYS"],
  Chemistry: ["CHEM"],
  "Child and Adolescent Development": ["CAD"],
  Cinema: ["CINE"],
  "Civil Engineering": ["ENGR", "MATH"],
  "Communication Studies": ["COMM"],
  "Computer Engineering": ["ENGR", "CSC", "MATH"],
  "Computer Science": ["CSC", "MATH"],
  "Creative Writing": ["C W", "ENG"],
  "Criminal Justice Studies": ["C J"],
  Dance: ["DANC"],
  "Decision Sciences": ["DS", "BUS"],
  Design: ["DES"],
  Economics: ["ECON"],
  "Electrical Engineering": ["ENGR", "MATH"],
  English: ["ENG"],
  "Environmental Studies": ["ENVS", "GEOG"],
  Finance: ["FIN", "BUS"],
  History: ["HIST"],
  "Hospitality and Tourism Management": ["HTM"],
  "Information Systems": ["ISYS", "BUS"],
  "International Business": ["IBUS", "BUS"],
  "International Relations": ["I R"],
  Journalism: ["JOUR"],
  Kinesiology: ["KIN"],
  "Latina/Latino Studies": ["LTNS"],
  "Liberal Studies": ["LS"],
  Management: ["MGMT", "BUS"],
  Marketing: ["MKTG", "BUS"],
  Mathematics: ["MATH"],
  "Mechanical Engineering": ["ENGR", "MATH"],
  Music: ["MUS"],
  Nursing: ["NURS"],
  "Nutrition and Dietetics": ["NUTR"],
  Philosophy: ["PHIL"],
  Physics: ["PHYS", "MATH"],
  "Political Science": ["PLSI"],
  Psychology: ["PSY"],
  "Public Health": ["PH"],
  "Social Work": ["S W"],
  Sociology: ["SOC"],
  Statistics: ["MATH"],
  "Theatre Arts": ["TH A"],
  "Urban Studies and Planning": ["USP"],
  "Visual Communication Design": ["DES"],
};

// Two assumptions, the only ones in this file: a student takes about two classes a term
// in the major's own subject, and half a class in each related subject.
const OWN_SUBJECT_CLASSES = 2;
const RELATED_SUBJECT_CLASSES = 0.5;
// Below this many known attendees the audience is treated as unknown.
const MIN_AUDIENCE = 3;

// For each subject: classes of that subject taken per audience member, on average.
export function audienceSubjects(audience: Audience): Map<string, number> | null {
  if (!audience) return null;
  const total = audience.reduce((sum, row) => sum + row.attendees, 0);
  const known = audience.filter((row) => MAJOR_SUBJECTS[row.major]);
  if (known.reduce((sum, row) => sum + row.attendees, 0) < MIN_AUDIENCE) return null;
  const subjects = new Map<string, number>();
  for (const row of known) {
    MAJOR_SUBJECTS[row.major].forEach((subject, index) => {
      const classes = index === 0 ? OWN_SUBJECT_CLASSES : RELATED_SUBJECT_CLASSES;
      subjects.set(subject, (subjects.get(subject) ?? 0) + (row.attendees / total) * classes);
    });
  }
  return subjects;
}

export type ClashContext = {
  clubId?: string | null;
  tags: string[];
  audience: Audience;
  buildingId?: string | null;
  room?: string | null;
};

export type ClashResult = {
  clashes: Clash[];
  // Share of the club's audience in class during the window. Null when unknown.
  audienceBusy: number | null;
  roomTaken: boolean;
  sameClubEvent: boolean;
  eventClashes: number;
  load: number;
  presence: number | null;
};

const MAX_CLASS_CLASHES = 3;
const MAX_EVENT_CLASHES = 2;
// Campus load from which the hour itself is reported as a clash.
const PEAK_LOAD = 0.7;

function percent(share: number): number {
  return Math.round(share * 100);
}

// Classes and events at the same time that pull the same audience.
// A class of subject S with E students takes (classes of S per audience member) x
// E / (all seats in S) of the audience: the chance that one of their S classes is this one.
export function findClashes(campus: Campus, events: OtherEvent[], window: Window, context: ClashContext): ClashResult {
  const span = spanOf(window);
  const clashes: Clash[] = [];
  const load = campusLoad(campus, window);
  const presence = campusPresence(campus, window);

  // The room itself.
  let roomTaken = false;
  if (context.buildingId && context.room) {
    const section = classInRoom(campus, context.buildingId, context.room, window);
    const event = eventInRoom(events, context.buildingId, context.room, window);
    if (section) {
      roomTaken = true;
      clashes.push({
        kind: "class",
        label: `${section.subject} ${section.number} ${section.title}`,
        startsAt: campusToIso(span.date, section.startMinute),
        endsAt: campusToIso(span.date, section.endMinute),
        audienceShare: null,
        note: `This class uses room ${section.room} until ${clock(section.endMinute)}.`,
      });
    } else if (event && !isSameEvent(event, window, context)) {
      roomTaken = true;
      clashes.push({
        kind: "event",
        label: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        audienceShare: null,
        note: "This event is in the same room.",
      });
    }
  }

  // Classes the audience takes.
  const subjects = audienceSubjects(context.audience);
  let audienceBusy: number | null = null;
  if (subjects) {
    const courses = new Map<string, { label: string; start: number; end: number; enrolled: number; share: number }>();
    for (const section of campus.byDay.get(span.weekday) ?? []) {
      const perMember = subjects.get(section.subject);
      const seats = campus.subjectSeats.get(section.subject) ?? 0;
      if (!perMember || seats === 0 || section.enrolled === 0 || !meets(section, span)) continue;
      const key = `${section.subject} ${section.number}`;
      const course = courses.get(key) ?? {
        label: `${key} ${section.title}`,
        start: section.startMinute,
        end: section.endMinute,
        enrolled: 0,
        share: 0,
      };
      course.start = Math.min(course.start, section.startMinute);
      course.end = Math.max(course.end, section.endMinute);
      course.enrolled += section.enrolled;
      course.share += (perMember * section.enrolled) / seats;
      courses.set(key, course);
    }
    const ranked = [...courses.values()].sort((a, b) => b.share - a.share);
    audienceBusy = Math.min(ranked.reduce((sum, course) => sum + course.share, 0), 1);
    for (const course of ranked.slice(0, MAX_CLASS_CLASHES)) {
      clashes.push({
        kind: "class",
        label: course.label,
        startsAt: campusToIso(span.date, course.start),
        endsAt: campusToIso(span.date, course.end),
        audienceShare: Math.round(Math.min(course.share, 1) * 1000) / 1000,
        note: `${course.enrolled} students are in this class, ${clock(course.start)} to ${clock(course.end)}.`,
      });
    }
  } else if (load >= PEAK_LOAD) {
    const table = campus.busy.get(span.weekday) ?? [];
    let students = 0;
    for (let bucket = Math.floor(span.start / BUCKET); bucket < Math.ceil(span.end / BUCKET); bucket++) {
      students = Math.max(students, table[bucket] ?? 0);
    }
    clashes.push({
      kind: "class",
      label: "Peak class hours",
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      audienceShare: null,
      note: `${students} students are in class then, ${percent(load)}% of the busiest hour of the week.`,
    });
  }

  // Events with the same club or a shared tag.
  const tags = context.tags.filter((tag) => tag !== "free food");
  const rivals = events
    .filter((event) => overlaps(event, window) && !isSameEvent(event, window, context))
    .map((event) => ({
      event,
      sameClub: Boolean(context.clubId) && event.clubId === context.clubId,
      shared: event.tags.filter((tag) => tags.includes(tag)),
    }))
    .filter((rival) => rival.sameClub || rival.shared.length > 0)
    .sort((a, b) => Number(b.sameClub) - Number(a.sameClub) || b.event.rsvpCount - a.event.rsvpCount);
  for (const rival of rivals.slice(0, MAX_EVENT_CLASHES)) {
    if (clashes.some((clash) => clash.kind === "event" && clash.label === rival.event.title)) continue;
    clashes.push({
      kind: "event",
      label: rival.event.title,
      startsAt: rival.event.startsAt,
      endsAt: rival.event.endsAt,
      audienceShare: null,
      note: rival.sameClub
        ? `Your club has this event at the same time. ${rival.event.rsvpCount} going.`
        : `Same tag (${rival.shared.join(", ")}). ${rival.event.rsvpCount} going.`,
    });
  }

  return {
    clashes,
    audienceBusy,
    roomTaken,
    sameClubEvent: rivals.some((rival) => rival.sameClub),
    eventClashes: rivals.length,
    load,
    presence,
  };
}

// The post form checks an event that may already be saved: same place and same times.
function isSameEvent(event: OtherEvent, window: Window, context: ClashContext): boolean {
  return (
    event.buildingId === context.buildingId &&
    Date.parse(event.startsAt) === Date.parse(window.startsAt) &&
    Date.parse(event.endsAt) === Date.parse(window.endsAt)
  );
}

// ---------------------------------------------------------------------------
// Scoring

// With a known audience, this share of it in class counts as fully busy.
const FULL_AUDIENCE_BUSY = 0.25;
// From this share of the busiest hour, enough students are on campus.
const ENOUGH_AROUND = 0.5;

export type ScoreInput = {
  clash: ClashResult;
  // This slot's expected turnout divided by the best expected turnout among the slots compared.
  forecastShare: number;
  // Room capacity and the seats needed. Capacity 0 means unknown.
  capacity: number;
  needed: number;
};

// 0 to 100. 60 for the audience being free while students are around, 20 for how many
// are around, 20 for the hour's turnout history. Then fixed penalties.
// An empty campus is not a good slot: free time only counts as far as students are on
// campus then, so Friday night does not win just because no class meets.
export function scoreSlot({ clash, forecastShare, capacity, needed }: ScoreInput): number {
  const busy =
    clash.audienceBusy === null
      ? clash.load
      : 0.5 * clash.load + 0.5 * Math.min(clash.audienceBusy / FULL_AUDIENCE_BUSY, 1);
  // Without a class schedule nothing is known about who is around, so it does not count against the slot.
  const presence = clash.presence === null ? 0 : Math.min(clash.presence, 1);
  const around = clash.presence === null ? 1 : Math.min(presence / ENOUGH_AROUND, 1);
  let score = 100 * (0.6 * (1 - busy) * around + 0.2 * presence + 0.2 * Math.min(forecastShare, 1));
  if (clash.roomTaken) score -= 50;
  if (clash.sameClubEvent) score -= 30;
  score -= Math.min(clash.eventClashes * 8, 24);
  // A room more than three times too big feels empty.
  if (capacity > 0 && needed > 0 && capacity > needed * 3) score -= Math.min((capacity / needed - 3) * 2, 10);
  return Math.round(Math.min(Math.max(score, 0), 100));
}

// The facts behind an option, for the reason text.
export type OptionFacts = {
  day: string;
  time: string;
  building: string;
  room: string;
  capacity: number;
  expectedPeople: number;
  clashes: string[];
  audienceInClassPercent: number | null;
  campusInClassPercent: number;
  studentsAroundPercent: number | null;
};

export type ScoredOption = PlanOption & { facts: OptionFacts; forecast: Forecast };

const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "long", month: "short", day: "numeric" });

// The reason in plain code. Also the fallback when the AI text does not pass the check.
export function codeReason(facts: OptionFacts): string {
  const parts: string[] = [];
  if (facts.clashes.length === 0) parts.push("No clashes");
  else parts.push(`${facts.clashes.length} ${facts.clashes.length === 1 ? "clash" : "clashes"}`);
  if (facts.audienceInClassPercent !== null) parts.push(`${facts.audienceInClassPercent}% of your audience in class`);
  else parts.push(`campus at ${facts.campusInClassPercent}% of its busiest hour`);
  if (facts.studentsAroundPercent !== null && facts.studentsAroundPercent >= 50) parts.push("many students on campus");
  if (facts.capacity > 0) parts.push(`${facts.capacity} seats for about ${facts.expectedPeople} people`);
  return `${parts.join(", ")}.`;
}

type SlotInput = {
  campus: Campus;
  events: OtherEvent[];
  past: PastEvent[];
  buildingNames: Map<string, string>;
  target: Omit<ForecastTarget, "startsAt">;
  audience: Audience;
  now: number;
};

type Built = { option: ScoredOption; clash: ClashResult; needed: number };

function buildOption(
  input: SlotInput,
  window: Window,
  place: { buildingId: string; room: string; capacity: number },
  needed: number | null,
): Built {
  const forecast = forecastTurnout({ ...input.target, buildingId: place.buildingId, startsAt: window.startsAt }, input.past, input.now);
  const clash = findClashes(input.campus, input.events, window, {
    clubId: input.target.clubId,
    tags: input.target.tags,
    audience: input.audience,
    buildingId: place.buildingId,
    room: place.room || null,
  });
  const span = spanOf(window);
  const facts: OptionFacts = {
    day: dayFormat.format(new Date(window.startsAt)),
    time: `${clock(span.start)} to ${clock(span.end % 1440)}`,
    building: input.buildingNames.get(place.buildingId) ?? place.buildingId,
    room: place.room,
    capacity: place.capacity,
    expectedPeople: forecast.expected,
    clashes: clash.clashes.map((item) => item.label),
    audienceInClassPercent: clash.audienceBusy === null ? null : percent(clash.audienceBusy),
    campusInClassPercent: percent(clash.load),
    studentsAroundPercent: clash.presence === null ? null : percent(Math.min(clash.presence, 1)),
  };
  return {
    clash,
    needed: needed ?? forecast.high,
    option: {
      buildingId: place.buildingId,
      buildingName: facts.building,
      room: place.room,
      capacity: place.capacity,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      score: 0,
      clashes: clash.clashes,
      reason: "",
      facts,
      forecast,
    },
  };
}

// Scores a set of options against each other and writes the code reason.
function finish(built: Built[]): ScoredOption[] {
  const best = Math.max(1, ...built.map(({ option }) => option.forecast.expected));
  return built.map(({ option, clash, needed }) => ({
    ...option,
    score: scoreSlot({ clash, forecastShare: option.forecast.expected / best, capacity: option.capacity, needed }),
    reason: codeReason(option.facts),
  }));
}

// Best first, never two picks on the same day within two hours of each other.
function pickBest(options: ScoredOption[], limit: number): ScoredOption[] {
  const sorted = [...options].sort(
    (a, b) => b.score - a.score || a.clashes.length - b.clashes.length || a.startsAt.localeCompare(b.startsAt),
  );
  const picked: ScoredOption[] = [];
  for (const option of sorted) {
    const near = picked.some(
      (other) =>
        campusTime(other.startsAt).date === campusTime(option.startsAt).date &&
        Math.abs(Date.parse(other.startsAt) - Date.parse(option.startsAt)) < 120 * MINUTE,
    );
    if (!near) picked.push(option);
    if (picked.length === limit) break;
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Planning from an idea

export type TimeWish = {
  dateFrom?: string | null;
  dateTo?: string | null;
  weekdays?: string[];
  earliestHour?: number | null;
  latestHour?: number | null;
  buildingId?: string | null;
};

export type Constraints = {
  dates: string[];
  earliestMinute: number;
  latestMinute: number;
  durationMinutes: number;
  buildingId: string | null;
};

const SEARCH_DAYS = 14;
const MAX_AHEAD_DAYS = 60;
const DEFAULT_EARLIEST = 10 * 60;
const DEFAULT_LATEST = 21 * 60;

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

// Turns the time wish the AI read into safe search bounds. Anything missing or
// out of range falls back to: the next two weeks, weekdays, 10 AM to 9 PM.
export function resolveConstraints(wish: TimeWish, durationMinutes: number, now: number = Date.now()): Constraints {
  const today = campusTime(now).date;
  const first = addDays(today, 1);
  const last = addDays(today, MAX_AHEAD_DAYS);
  const duration = Math.min(Math.max(Math.round(durationMinutes) || 90, 30), 480);

  let from = validDate(wish.dateFrom) && wish.dateFrom >= first && wish.dateFrom <= last ? wish.dateFrom : first;
  let to = validDate(wish.dateTo) && wish.dateTo >= from ? wish.dateTo : validDate(wish.dateFrom) ? from : addDays(from, SEARCH_DAYS - 1);
  if (validDate(wish.dateFrom) && !validDate(wish.dateTo) && wish.dateFrom === from) to = from;
  if (to > last) to = last;
  if (to > addDays(from, SEARCH_DAYS * 2)) to = addDays(from, SEARCH_DAYS * 2);
  if (from > to) from = to;

  const asked = (wish.weekdays ?? []).map((day) => day.toLowerCase().slice(0, 3)).filter((day) => day in DAY_NAMES);
  const oneDay = from === to;
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = weekdayOfDate(date);
    const wanted = asked.length > 0 ? asked.includes(weekday) : oneDay || (weekday !== "sat" && weekday !== "sun");
    if (wanted) dates.push(date);
  }
  // A weekday that does not fall in the range: look at the next two weeks instead.
  if (dates.length === 0) {
    for (let offset = 1; offset <= SEARCH_DAYS; offset++) {
      const date = addDays(today, offset);
      if (asked.includes(weekdayOfDate(date))) dates.push(date);
    }
  }

  const hour = (value: unknown) => (typeof value === "number" && value >= 0 && value <= 24 ? Math.round(value * 60) : null);
  const earliest = Math.min(Math.max(hour(wish.earliestHour) ?? DEFAULT_EARLIEST, 7 * 60), 21 * 60);
  let latest = Math.min(Math.max(hour(wish.latestHour) ?? DEFAULT_LATEST, 8 * 60), 23 * 60);
  if (latest < earliest + duration) latest = Math.min(earliest + duration, 1440);

  return { dates, earliestMinute: earliest, latestMinute: latest, durationMinutes: duration, buildingId: wish.buildingId ?? null };
}

export type PlanInput = SlotInput & {
  constraints: Constraints;
  // Seats the host asked for. Null when not said.
  expectedPeople: number | null;
};

const SLOT_STEP = 30;

// Every half hour in the wished range gets its best free room, a forecast, its
// clashes and a score. Returns the best three.
export function planOptions(input: PlanInput, limit = 3): ScoredOption[] {
  const built: Built[] = [];
  const { constraints } = input;
  for (const date of constraints.dates) {
    for (
      let start = constraints.earliestMinute;
      start + constraints.durationMinutes <= constraints.latestMinute;
      start += SLOT_STEP
    ) {
      const window = {
        startsAt: campusToIso(date, start),
        endsAt: campusToIso(date, start + constraints.durationMinutes),
      };
      if (Date.parse(window.startsAt) <= input.now) continue;
      const forecast = forecastTurnout({ ...input.target, startsAt: window.startsAt }, input.past, input.now);
      const needed = Math.max(forecast.high, input.expectedPeople ?? 0);
      const free = findFreeRooms(input.campus, input.events, window, needed);
      // The building the host named first, then the tightest fit.
      const room = free.find((candidate) => candidate.buildingId === constraints.buildingId) ?? free[0];
      if (!room) continue;
      built.push(buildOption(input, window, room, needed));
    }
  }
  return pickBest(finish(built), limit);
}

// ---------------------------------------------------------------------------
// Checking one chosen slot

export type CheckInput = SlotInput & {
  buildingId: string;
  room: string | null;
  window: Window;
};

export type CheckResult = { forecast: Forecast; clashes: Clash[]; betterSlots: ScoredOption[]; score: number };

const SHIFTS_MINUTES = [-180, -150, -120, -90, -60, -30, 30, 60, 90, 120, 150, 180];
const SHIFTS_DAYS = [-2, -1, 1, 2, 3];
const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
// How much better a slot must score to be offered.
const BETTER_BY = 8;
const BETTER_BY_WHEN_CLEAR = 15;

// The chosen slot, and up to three better ones near it: the same day within three
// hours, or the same hour on a nearby day. The place stays the same when it is free.
export function checkSlot(input: CheckInput): CheckResult {
  const { campus, events, window, buildingId } = input;
  const length = Date.parse(window.endsAt) - Date.parse(window.startsAt);
  const start = campusTime(window.startsAt);
  const hasRooms = campus.buildingsWithRooms.has(buildingId);
  const known = input.room
    ? campus.rooms.find((room) => room.buildingId === buildingId && normalizeRoom(room.room) === normalizeRoom(input.room!))
    : undefined;

  const chosen = buildOption(
    input,
    window,
    { buildingId, room: known?.room ?? input.room ?? "", capacity: known?.capacity ?? 0 },
    null,
  );

  const candidates: Built[] = [];
  const moves = [
    ...SHIFTS_MINUTES.map((minutes) => ({ date: start.date, minute: start.minute + minutes })),
    ...SHIFTS_DAYS.map((days) => ({ date: addDays(start.date, days), minute: start.minute })),
  ];
  for (const move of moves) {
    if (move.minute < DAY_START || move.minute + length / MINUTE > DAY_END) continue;
    const startsAt = campusToIso(move.date, move.minute);
    const candidate = { startsAt, endsAt: new Date(Date.parse(startsAt) + length).toISOString() };
    if (Date.parse(startsAt) <= input.now) continue;

    let place: { buildingId: string; room: string; capacity: number } | null;
    if (!hasRooms) {
      // No room data for this building: only the time moves.
      place = { buildingId, room: input.room ?? "", capacity: 0 };
    } else if (known && isRoomFree(campus, events, buildingId, known.room, candidate)) {
      place = known;
    } else {
      const needed = known?.capacity ? Math.min(known.capacity, chosen.option.forecast.high) : chosen.option.forecast.high;
      place = findFreeRooms(campus, events, candidate, needed, buildingId)[0] ?? null;
    }
    if (place) candidates.push(buildOption(input, candidate, place, null));
  }

  const [scored, ...others] = finish([chosen, ...candidates]);
  const margin = scored.clashes.length === 0 ? BETTER_BY_WHEN_CLEAR : BETTER_BY;
  return {
    forecast: scored.forecast,
    clashes: scored.clashes,
    score: scored.score,
    betterSlots: pickBest(
      others.filter((option) => option.score >= scored.score + margin),
      3,
    ),
  };
}

// ---------------------------------------------------------------------------
// Guard for AI text

// True when every number in the text is one of the facts. The AI may word a reason,
// it may not bring a number, a room or a time of its own.
export function reasonUsesOnlyFacts(reason: string, facts: OptionFacts): boolean {
  const allowed = new Set(JSON.stringify(facts).match(/\d+/g) ?? []);
  return (reason.match(/\d+/g) ?? []).every((number) => allowed.has(number));
}

// Drops the internal fields so the option matches the shared contract.
export function toPlanOption(option: ScoredOption): PlanOption {
  return {
    buildingId: option.buildingId,
    buildingName: option.buildingName,
    room: option.room,
    capacity: option.capacity,
    startsAt: option.startsAt,
    endsAt: option.endsAt,
    score: option.score,
    clashes: option.clashes,
    reason: option.reason,
  };
}
