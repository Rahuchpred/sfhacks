// How busy each building is at a moment: students in class there (from the real class
// schedule) plus people checked in at events happening there. Pure code, no AI.
import { campusTime, type Campus } from "@/lib/planner";

export type BuildingBusy = {
  buildingId: string;
  // Students enrolled in classes meeting in the building right now.
  inClass: number;
  // People checked in at events in the building right now.
  atEvents: number;
  total: number;
};

export type BusyNow = {
  at: string;
  buildings: BuildingBusy[];
  // The largest total, so the map can scale its glow.
  max: number;
  // False outside the term or at night, when no class meets.
  classesInSession: boolean;
  sample: boolean;
};

export type LiveEvent = { buildingId: string; checkedIn: number };

export function busyAt(
  campus: Campus,
  liveEvents: LiveEvent[],
  at: Date,
  sample: boolean,
): BusyNow {
  const now = campusTime(at);
  const totals = new Map<string, BuildingBusy>();
  const entry = (buildingId: string) => {
    let row = totals.get(buildingId);
    if (!row) {
      row = { buildingId, inClass: 0, atEvents: 0, total: 0 };
      totals.set(buildingId, row);
    }
    return row;
  };

  const inTerm =
    (!campus.termStart || now.date >= campus.termStart) &&
    (!campus.termEnd || now.date <= campus.termEnd);
  let classesInSession = false;
  if (inTerm) {
    for (const section of campus.byDay.get(now.weekday) ?? []) {
      if (!section.buildingId || section.enrolled <= 0) continue;
      if (section.startsOn && now.date < section.startsOn) continue;
      if (section.endsOn && now.date > section.endsOn) continue;
      if (now.minute < section.startMinute || now.minute >= section.endMinute) continue;
      entry(section.buildingId).inClass += section.enrolled;
      classesInSession = true;
    }
  }
  for (const event of liveEvents) {
    if (event.checkedIn > 0) entry(event.buildingId).atEvents += event.checkedIn;
  }

  const buildings = [...totals.values()]
    .map((row) => ({ ...row, total: row.inClass + row.atEvents }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
  return {
    at: at.toISOString(),
    buildings,
    max: buildings[0]?.total ?? 0,
    classesInSession,
    sample,
  };
}
