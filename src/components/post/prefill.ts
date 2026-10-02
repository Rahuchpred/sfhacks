// A plan chosen on /plan, carried to the post form through session storage.

export type EventPrefill = {
  title: string;
  description: string;
  tags: string[];
  hasFood: boolean;
  clubId: string | null;
  clubName: string;
  buildingId: string;
  room: string;
  startsAt: string;
  endsAt: string;
  // The host's own head count from the idea, so the form's forecast matches the planner's.
  expectedPeople?: number | null;
};

const KEY = "gator-radar:plan-prefill";

export function savePrefill(prefill: EventPrefill) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(prefill));
  } catch {
    // Storage is off: the post form just opens empty.
  }
}

// Reads the saved plan once and clears it, so a later visit to /post starts empty.
export function takePrefill(): EventPrefill | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as EventPrefill;
  } catch {
    return null;
  }
}
