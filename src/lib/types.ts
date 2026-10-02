// Shared app types. Frozen contract: see src/lib/contracts.md before changing.

export type Building = {
  id: string;
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
};

export type EventSource = "organizer" | "flyer" | "seed";

export type CampusEvent = {
  id: string;
  title: string;
  description: string;
  clubName: string;
  buildingId: string;
  room: string | null;
  startsAt: string; // ISO 8601
  endsAt: string;
  tags: string[];
  hasFood: boolean;
  flyerUrl: string | null;
  source: EventSource;
  createdBy: string | null;
};

export type RescueStatus = "open" | "gone" | "expired";

export type FoodRescue = {
  id: string;
  eventId: string | null;
  buildingId: string;
  room: string | null;
  photoUrl: string;
  items: string;
  portions: number;
  portionsLeft: number;
  dietary: string[];
  safeUntil: string; // ISO 8601
  status: RescueStatus;
  createdBy: string | null;
};

export type NewCampusEvent = Omit<CampusEvent, "id" | "createdBy">;
export type NewFoodRescue = Omit<
  FoodRescue,
  "id" | "createdBy" | "portionsLeft" | "status"
>;

export type ClaimResult = {
  ok: boolean;
  portionsLeft: number;
  reason: "not_signed_in" | "not_found" | "gone" | "expired" | "already_claimed" | null;
};

// AI route contracts

export type EventDraft = {
  title: string | null;
  description: string | null;
  clubName: string | null;
  buildingId: string | null;
  room: string | null;
  startsAt: string | null;
  endsAt: string | null;
  tags: string[];
  hasFood: boolean | null;
};

export type ExtractEventRequest = { text?: string; imageUrl?: string };
export type ExtractEventResponse = {
  event: EventDraft;
  missing: string[];
  confidence: number;
};

export type EventIssue = {
  field: string;
  message: string;
  severity: "error" | "warn";
};
export type CheckEventRequest = { event: EventDraft };
export type CheckEventResponse = {
  ok: boolean;
  issues: EventIssue[];
  questions: string[];
};

export type EstimateFoodRequest = { imageUrl: string; postedAt: string };
export type EstimateFoodResponse = {
  items: string;
  portions: number;
  dietary: string[];
  safeUntil: string;
  note: string;
};
