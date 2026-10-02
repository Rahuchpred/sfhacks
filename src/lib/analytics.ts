// Organizer analytics. Every number shown to a club, sent to the AI or put in
// the school report is counted here in plain code.
import type { AttendanceRow, CampusEvent, FoodRescue } from "@/lib/types";

const TIMEZONE = "America/Los_Angeles";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short" });
const hourFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hour: "numeric",
  hour12: false,
});
const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  month: "short",
  day: "numeric",
});

export type Count = { label: string; count: number };

export type EventStat = {
  id: string;
  title: string;
  date: string;
  startsAt: string;
  weekday: string;
  started: boolean;
  registered: number;
  checkedIn: number;
  turnoutPct: number | null;
  hasFood: boolean;
  cost: number | null;
  leftoverPortions: number;
  portionsClaimed: number;
  predictedCheckIns: number | null; // upcoming events only
};

export type Person = {
  guestId: string;
  name: string;
  major: string;
  gradYear: number | null;
  verified: boolean;
  registered: number;
  attended: number;
};

export type Analytics = {
  totals: {
    events: number;
    registrations: number;
    checkIns: number;
    turnoutPct: number | null;
    uniqueStudents: number;
    totalCost: number;
    costPerAttendee: number | null;
    leftoverPortions: number;
    portionsClaimed: number;
  };
  events: EventStat[];
  byMajor: Count[];
  byYear: Count[];
  loyalty: Count[];
  arrival: Count[];
  byWeekday: { label: string; events: number; turnoutPct: number | null }[];
  byTimeOfDay: { label: string; events: number; turnoutPct: number | null }[];
  food: {
    withFood: { events: number; avgCheckIns: number | null };
    withoutFood: { events: number; avgCheckIns: number | null };
    foodEvents: number;
    avgLeftover: number | null;
  };
  showRate: number | null;
  people: Person[];
};

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function avg(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

function countBy(labels: string[], limit = 7): Count[] {
  const map = new Map<string, number>();
  for (const label of labels) map.set(label, (map.get(label) ?? 0) + 1);
  const sorted = [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  if (sorted.length <= limit) return sorted;
  const rest = sorted.slice(limit - 1).reduce((sum, item) => sum + item.count, 0);
  return [...sorted.slice(0, limit - 1), { label: "Other", count: rest }];
}

function timeOfDay(iso: string): string {
  const hour = Number(hourFormat.format(new Date(iso))) % 24;
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export function buildAnalytics(
  events: CampusEvent[],
  rows: AttendanceRow[],
  rescues: FoodRescue[],
  now: number = Date.now(),
): Analytics {
  const eventIds = new Set(events.map((event) => event.id));
  const scoped = rows.filter((row) => eventIds.has(row.eventId));
  const startById = new Map(events.map((event) => [event.id, Date.parse(event.startsAt)]));

  // The share of sign-ups that turn into check-ins, from events that already started.
  const started = events.filter((event) => Date.parse(event.startsAt) <= now);
  const startedIds = new Set(started.map((event) => event.id));
  const startedRows = scoped.filter((row) => startedIds.has(row.eventId));
  const startedCheckIns = startedRows.filter((row) => row.checkedInAt).length;
  const showRate = startedRows.length > 0 ? startedCheckIns / startedRows.length : null;

  const eventStats: EventStat[] = events
    .map((event) => {
      const eventRows = scoped.filter((row) => row.eventId === event.id);
      const checkedIn = eventRows.filter((row) => row.checkedInAt).length;
      const eventRescues = rescues.filter((rescue) => rescue.eventId === event.id);
      const leftover = eventRescues.reduce((sum, rescue) => sum + rescue.portions, 0);
      const left = eventRescues.reduce((sum, rescue) => sum + rescue.portionsLeft, 0);
      const hasStarted = startedIds.has(event.id);
      return {
        id: event.id,
        title: event.title,
        date: dateFormat.format(new Date(event.startsAt)),
        startsAt: event.startsAt,
        weekday: weekdayFormat.format(new Date(event.startsAt)),
        started: hasStarted,
        registered: eventRows.length,
        checkedIn,
        turnoutPct: hasStarted ? pct(checkedIn, eventRows.length) : null,
        hasFood: event.hasFood,
        cost: event.cost,
        leftoverPortions: leftover,
        portionsClaimed: leftover - left,
        predictedCheckIns:
          !hasStarted && showRate !== null ? Math.round(eventRows.length * showRate) : null,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const checkedInRows = scoped.filter((row) => row.checkedInAt);
  const startedStats = eventStats.filter((event) => event.started);

  // One entry per student, so a regular does not count ten times in the major chart.
  const peopleMap = new Map<string, Person>();
  for (const row of scoped) {
    const person = peopleMap.get(row.guestId) ?? {
      guestId: row.guestId,
      name: row.guestName,
      major: row.major,
      gradYear: row.gradYear,
      verified: row.sfsuVerified,
      registered: 0,
      attended: 0,
    };
    person.registered += 1;
    if (row.checkedInAt) person.attended += 1;
    peopleMap.set(row.guestId, person);
  }
  const people = [...peopleMap.values()].sort(
    (a, b) => b.attended - a.attended || a.name.localeCompare(b.name),
  );
  const attendees = people.filter((person) => person.attended > 0);

  const arrivalBuckets = ["Early", "0 to 10 min", "10 to 20 min", "20 to 30 min", "30+ min"];
  const arrivalLabels = checkedInRows.map((row) => {
    const minutes = (Date.parse(row.checkedInAt!) - (startById.get(row.eventId) ?? 0)) / 60_000;
    if (minutes < 0) return arrivalBuckets[0];
    if (minutes < 10) return arrivalBuckets[1];
    if (minutes < 20) return arrivalBuckets[2];
    if (minutes < 30) return arrivalBuckets[3];
    return arrivalBuckets[4];
  });

  const groupTurnout = (key: (event: EventStat) => string, order: string[]) =>
    order
      .map((label) => {
        const group = startedStats.filter((event) => key(event) === label);
        const registered = group.reduce((sum, event) => sum + event.registered, 0);
        const checkedIn = group.reduce((sum, event) => sum + event.checkedIn, 0);
        return { label, events: group.length, turnoutPct: pct(checkedIn, registered) };
      })
      .filter((group) => group.events > 0);

  const withFood = startedStats.filter((event) => event.hasFood);
  const withoutFood = startedStats.filter((event) => !event.hasFood);
  const foodEvents = startedStats.filter((event) => event.leftoverPortions > 0);
  const totalCost = events.reduce((sum, event) => sum + (event.cost ?? 0), 0);
  const leftoverPortions = eventStats.reduce((sum, event) => sum + event.leftoverPortions, 0);

  return {
    totals: {
      events: events.length,
      registrations: scoped.length,
      checkIns: checkedInRows.length,
      turnoutPct: pct(startedCheckIns, startedRows.length),
      uniqueStudents: attendees.length,
      totalCost,
      costPerAttendee:
        totalCost > 0 && checkedInRows.length > 0
          ? Math.round((totalCost / checkedInRows.length) * 100) / 100
          : null,
      leftoverPortions,
      portionsClaimed: eventStats.reduce((sum, event) => sum + event.portionsClaimed, 0),
    },
    events: eventStats,
    byMajor: countBy(attendees.map((person) => person.major.trim() || "Not given")),
    byYear: countBy(
      attendees.map((person) => (person.gradYear ? `Class of ${person.gradYear}` : "Not given")),
    ).sort((a, b) => a.label.localeCompare(b.label)),
    loyalty: [
      { label: "First time", count: attendees.filter((person) => person.attended === 1).length },
      { label: "Came back", count: attendees.filter((person) => person.attended > 1).length },
    ],
    arrival: arrivalBuckets.map((label) => ({
      label,
      count: arrivalLabels.filter((item) => item === label).length,
    })),
    byWeekday: groupTurnout((event) => event.weekday, WEEKDAYS),
    byTimeOfDay: groupTurnout(
      (event) => timeOfDay(event.startsAt),
      ["Morning", "Afternoon", "Evening"],
    ),
    food: {
      withFood: { events: withFood.length, avgCheckIns: avg(withFood.map((e) => e.checkedIn)) },
      withoutFood: {
        events: withoutFood.length,
        avgCheckIns: avg(withoutFood.map((e) => e.checkedIn)),
      },
      foodEvents: foodEvents.length,
      avgLeftover: avg(foodEvents.map((event) => event.leftoverPortions)),
    },
    showRate,
    people,
  };
}

// What the AI is allowed to see: counts only, no names and no per-person rows.
export function aiStats(analytics: Analytics) {
  return {
    totals: analytics.totals,
    showRatePercent: analytics.showRate === null ? null : Math.round(analytics.showRate * 100),
    events: analytics.events.map((event) => ({
      title: event.title,
      date: event.date,
      weekday: event.weekday,
      timeOfDay: timeOfDay(event.startsAt),
      started: event.started,
      registered: event.registered,
      checkedIn: event.checkedIn,
      turnoutPercent: event.turnoutPct,
      hasFood: event.hasFood,
      cost: event.cost,
      leftoverPortions: event.leftoverPortions,
      leftoverPortionsClaimed: event.portionsClaimed,
    })),
    attendeesByMajor: analytics.byMajor,
    attendeesByYear: analytics.byYear,
    firstTimeVersusReturning: analytics.loyalty,
    arrivalTimes: analytics.arrival,
    turnoutByWeekday: analytics.byWeekday,
    turnoutByTimeOfDay: analytics.byTimeOfDay,
    food: analytics.food,
  };
}

function csvCell(value: string | number | boolean | null): string {
  const text = value === null ? "" : String(value);
  // A leading =, +, - or @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function csvBlock(title: string, header: string[], rows: (string | number | boolean | null)[][]) {
  return [title, header.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
}

// One file for the school: events with cost and turnout, attendance per event, and people.
export function schoolReportCsv(
  analytics: Analytics,
  events: CampusEvent[],
  rows: AttendanceRow[],
): string {
  const titleById = new Map(events.map((event) => [event.id, event.title]));
  const eventIds = new Set(events.map((event) => event.id));
  const t = analytics.totals;

  return [
    csvBlock(
      "SUMMARY",
      ["Events", "Registrations", "Check-ins", "Turnout %", "Unique students", "Total cost", "Cost per attendee", "Leftover portions posted", "Leftover portions claimed"],
      [[t.events, t.registrations, t.checkIns, t.turnoutPct, t.uniqueStudents, t.totalCost, t.costPerAttendee, t.leftoverPortions, t.portionsClaimed]],
    ),
    csvBlock(
      "EVENTS",
      ["Event", "Date", "Weekday", "Registered", "Checked in", "Turnout %", "Free food", "Cost", "Leftover portions posted", "Leftover portions claimed"],
      analytics.events.map((e) => [e.title, e.date, e.weekday, e.registered, e.checkedIn, e.turnoutPct, e.hasFood ? "yes" : "no", e.cost, e.leftoverPortions, e.portionsClaimed]),
    ),
    csvBlock(
      "ATTENDANCE",
      ["Event", "Student", "Major", "Graduation year", "Verified SFSU", "Registered at", "Checked in at"],
      rows
        .filter((row) => eventIds.has(row.eventId))
        .map((row) => [titleById.get(row.eventId) ?? "", row.guestName, row.major, row.gradYear, row.sfsuVerified ? "yes" : "no", row.registeredAt, row.checkedInAt]),
    ),
    csvBlock(
      "PEOPLE",
      ["Student", "Major", "Graduation year", "Verified SFSU", "Events registered", "Events attended"],
      analytics.people.map((p) => [p.name, p.major, p.gradYear, p.verified ? "yes" : "no", p.registered, p.attended]),
    ),
  ].join("\n\n");
}
