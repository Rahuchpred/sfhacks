// The daily report for organizers: every event grouped by day, plus two flat
// tables shaped like a form-response sheet (header in row one, one record per
// row). Pure code, no network. The counting itself comes from buildAnalytics.
import { buildAnalytics } from "@/lib/analytics";
import type { AttendanceRow, Building, CampusEvent, FoodRescue } from "@/lib/types";

const TIMEZONE = "America/Los_Angeles";
// en-CA prints the date as 2026-10-02, which a spreadsheet reads as a real date.
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dayLabelFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeLabelFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

export type ReportEvent = {
  id: string;
  date: string; // 2026-10-02, campus time
  time: string; // 5:30 PM
  title: string;
  club: string;
  building: string;
  started: boolean;
  registered: number;
  checkedIn: number;
  turnoutPct: number | null; // null until the event starts or when nobody registered
  foodPosted: number;
  foodClaimed: number;
  cost: number | null;
};

export type ReportTotals = {
  events: number;
  registered: number;
  checkedIn: number;
  turnoutPct: number | null;
  foodPosted: number;
  foodClaimed: number;
  cost: number;
};

export type ReportDay = {
  date: string;
  label: string; // Fri, Oct 2, 2026
  events: ReportEvent[];
  totals: ReportTotals;
};

export type ReportCheckIn = {
  rsvpId: string;
  event: string;
  date: string;
  student: string;
  major: string;
  gradYear: number | null;
  verified: boolean;
  registeredAt: string; // 2026-10-02 17:30, campus time
  checkedInAt: string;
};

export type Report = {
  days: ReportDay[]; // newest day first
  totals: ReportTotals;
  checkIns: ReportCheckIn[]; // newest first
};

export type Cell = string | number | null;
export type Table = { name: string; header: string[]; rows: Cell[][] };

function dayKey(iso: string): string {
  return dayKeyFormat.format(new Date(iso));
}

// Today on campus, for the printed date and the file name. The UTC date is a day ahead in the evening.
export function reportDate(now: number = Date.now()): string {
  return dayKeyFormat.format(new Date(now));
}

function stamp(iso: string): string {
  return `${dayKey(iso)} ${clockFormat.format(new Date(iso))}`;
}

// Turnout counts only events that already started, the same rule as analytics.
function totalsOf(events: ReportEvent[]): ReportTotals {
  const sum = (pick: (event: ReportEvent) => number) =>
    events.reduce((total, event) => total + pick(event), 0);
  const started = events.filter((event) => event.started);
  const startedRegistered = started.reduce((total, event) => total + event.registered, 0);
  const startedCheckedIn = started.reduce((total, event) => total + event.checkedIn, 0);
  return {
    events: events.length,
    registered: sum((event) => event.registered),
    checkedIn: sum((event) => event.checkedIn),
    turnoutPct:
      startedRegistered > 0 ? Math.round((startedCheckedIn / startedRegistered) * 100) : null,
    foodPosted: sum((event) => event.foodPosted),
    foodClaimed: sum((event) => event.foodClaimed),
    cost: sum((event) => event.cost ?? 0),
  };
}

export function buildReport(
  events: CampusEvent[],
  rows: AttendanceRow[],
  rescues: FoodRescue[],
  buildings: Building[],
  now: number = Date.now(),
): Report {
  const stats = new Map(
    buildAnalytics(events, rows, rescues, now).events.map((event) => [event.id, event]),
  );
  const buildingName = new Map(buildings.map((building) => [building.id, building.name]));
  const eventById = new Map(events.map((event) => [event.id, event]));

  const reportEvents: ReportEvent[] = [...events]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((event) => {
      const stat = stats.get(event.id);
      return {
        id: event.id,
        date: dayKey(event.startsAt),
        time: timeLabelFormat.format(new Date(event.startsAt)),
        title: event.title,
        club: event.clubName,
        building: buildingName.get(event.buildingId) ?? "",
        started: stat?.started ?? false,
        registered: stat?.registered ?? 0,
        checkedIn: stat?.checkedIn ?? 0,
        turnoutPct: stat?.turnoutPct ?? null,
        foodPosted: stat?.leftoverPortions ?? 0,
        foodClaimed: stat?.portionsClaimed ?? 0,
        cost: event.cost,
      };
    });

  const byDay = new Map<string, ReportEvent[]>();
  for (const event of reportEvents) {
    byDay.set(event.date, [...(byDay.get(event.date) ?? []), event]);
  }
  const days: ReportDay[] = [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayEvents]) => ({
      date,
      // Noon keeps the label on the right day whatever the offset is.
      label: dayLabelFormat.format(new Date(`${date}T12:00:00-08:00`)),
      events: dayEvents,
      totals: totalsOf(dayEvents),
    }));

  const checkIns: ReportCheckIn[] = rows
    .filter((row) => row.checkedInAt && eventById.has(row.eventId))
    .sort((a, b) => b.checkedInAt!.localeCompare(a.checkedInAt!))
    .map((row) => {
      const event = eventById.get(row.eventId)!;
      return {
        rsvpId: row.rsvpId,
        event: event.title,
        date: dayKey(event.startsAt),
        student: row.guestName,
        major: row.major,
        gradYear: row.gradYear,
        verified: row.sfsuVerified,
        registeredAt: stamp(row.registeredAt),
        checkedInAt: stamp(row.checkedInAt!),
      };
    });

  return { days, totals: totalsOf(reportEvents), checkIns };
}

// The two export tables. One header row, then one record per row, no total rows:
// a spreadsheet can sum, filter and pivot them as they are.

export function eventsTable(report: Report): Table {
  return {
    name: "Events",
    header: [
      "Date",
      "Event",
      "Club",
      "Building",
      "Registered",
      "Checked in",
      "Turnout %",
      "Food posted",
      "Food claimed",
      "Cost",
    ],
    rows: [...report.days]
      .reverse()
      .flatMap((day) => day.events)
      .map((event) => [
        event.date,
        event.title,
        event.club,
        event.building,
        event.registered,
        event.checkedIn,
        event.turnoutPct,
        event.foodPosted,
        event.foodClaimed,
        event.cost,
      ]),
  };
}

export function checkInsTable(report: Report): Table {
  return {
    name: "Check-ins",
    header: [
      "Event",
      "Date",
      "Student",
      "Major",
      "Graduation year",
      "Verified SFSU",
      "Registered at",
      "Checked in at",
    ],
    rows: [...report.checkIns]
      .reverse()
      .map((row) => [
        row.event,
        row.date,
        row.student,
        row.major,
        row.gradYear,
        row.verified ? "yes" : "no",
        row.registeredAt,
        row.checkedInAt,
      ]),
  };
}

// A leading =, +, - or @ would run as a formula in a spreadsheet.
function safeText(value: Cell): string {
  const text = value === null ? "" : String(value);
  return typeof value === "string" && /^[=+\-@]/.test(text) ? `'${text}` : text;
}

// Tab-separated text, the format Google Sheets and Excel take from the clipboard.
// A tab or a line break inside a cell would shift the grid, so they become spaces.
export function toTsv(table: Table): string {
  const cell = (value: Cell) => safeText(value).replace(/[\t\r\n]+/g, " ");
  return [table.header, ...table.rows].map((row) => row.map(cell).join("\t")).join("\n");
}

export function toCsv(table: Table): string {
  const cell = (value: Cell) => {
    const text = safeText(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [table.header, ...table.rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlTable(table: Table, footer?: Cell[]): string {
  const numeric = table.header.map((_, column) =>
    table.rows.some((row) => typeof row[column] === "number"),
  );
  const cells = (row: Cell[], tag: "td" | "th") =>
    row
      .map(
        (value, column) =>
          `<${tag}${numeric[column] ? ' class="n"' : ""}>${escapeHtml(value === null ? "" : String(value))}</${tag}>`,
      )
      .join("");
  return [
    `<h2>${escapeHtml(table.name)} (${table.rows.length})</h2>`,
    "<table>",
    `<thead><tr>${cells(table.header, "th")}</tr></thead>`,
    `<tbody>${table.rows.map((row) => `<tr>${cells(row, "td")}</tr>`).join("")}</tbody>`,
    footer ? `<tfoot><tr>${cells(footer, "td")}</tr></tfoot>` : "",
    "</table>",
  ].join("");
}

// A standalone page for printing: both tables, black on white, no app chrome.
export function reportPrintHtml(report: Report, scope: string, printedOn: string): string {
  const t = report.totals;
  const total: Cell[] = [
    "Total",
    `${t.events} ${t.events === 1 ? "event" : "events"}`,
    "",
    "",
    t.registered,
    t.checkedIn,
    t.turnoutPct,
    t.foodPosted,
    t.foodClaimed,
    t.cost,
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Event report</title>
<style>
  @page { size: landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 11px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #000; background: #fff; }
  h1 { margin: 0; font-size: 18px; }
  .meta { margin: 2px 0 0; color: #555; }
  h2 { margin: 22px 0 6px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { padding: 4px 8px 4px 0; text-align: left; vertical-align: top; border-bottom: 1px solid #ddd; }
  th { font-weight: 600; border-bottom: 1px solid #000; }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 600; border-top: 1px solid #000; border-bottom: 0; }
</style>
</head>
<body>
<h1>Event report</h1>
<p class="meta">${escapeHtml(scope)} · Printed ${escapeHtml(printedOn)} · Unofficial, from Gator Radar</p>
${htmlTable(eventsTable(report), total)}
${htmlTable(checkInsTable(report))}
</body>
</html>`;
}
