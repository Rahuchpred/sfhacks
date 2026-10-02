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
  rsvpCount: number;
  checkedInCount: number;
  clubId: string | null; // set when the event belongs to a club
  foodItems: string[]; // what food will be there, from FOOD_OPTIONS
  cost: number | null; // dollars spent, entered by the organizer
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
  maxPerPerson: number; // set by the poster, 1 to 10
  dietary: string[];
  safeUntil: string; // ISO 8601
  status: RescueStatus;
  createdBy: string | null;
};

export type NewCampusEvent = Omit<
  CampusEvent,
  "id" | "createdBy" | "rsvpCount" | "checkedInCount" | "clubId" | "foodItems" | "cost"
> & { clubId?: string | null; foodItems?: string[]; cost?: number | null };
export type EventUpdate = Partial<NewCampusEvent>;
export type NewFoodRescue = Omit<
  FoodRescue,
  "id" | "createdBy" | "portionsLeft" | "status"
>;

export type ClaimResult = {
  ok: boolean;
  portionsLeft: number;
  reason: "not_signed_in" | "not_found" | "gone" | "expired" | "already_claimed" | null;
  claimCode: string | null; // 4 characters, shown to the poster at pickup
  expiresAt: string | null; // the hold ends here unless the pickup is confirmed
};

// A portion the signed-in student is holding or has picked up.
export type MyClaim = {
  id: string;
  rescueId: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  pickedUpAt: string | null;
};

export type PickupResult = {
  ok: boolean;
  reason: "not_host" | "not_found" | "already_picked_up" | null;
  guestName: string | null;
};

// A hold on a rescue, as its poster sees it. No codes: the student shows theirs.
export type RescueClaim = {
  claimId: string;
  guestName: string;
  createdAt: string;
  expiresAt: string;
  pickedUpAt: string | null;
};

// Clubs

export type Club = { id: string; name: string; createdBy: string };
export type MyClub = Club & { role: "owner" | "organizer"; joinCode: string };
export type ClubMember = {
  uid: string;
  name: string;
  role: "owner" | "organizer";
  joinedAt: string;
};

// One registration at an event the signed-in user manages. Raw rows for analytics.
export type AttendanceRow = {
  eventId: string;
  rsvpId: string;
  guestId: string;
  guestName: string;
  major: string;
  gradYear: number | null;
  sfsuVerified: boolean;
  registeredAt: string;
  checkedInAt: string | null;
};


// RSVPs, tickets and check-in

export type Ticket = {
  id: string;
  eventId: string;
  code: string; // 8 characters, shown as the QR code and typed by hand as a fallback
  createdAt: string;
  checkedInAt: string | null;
};

export type TicketWithEvent = Ticket & { event: CampusEvent };

export type CheckInResult = {
  ok: boolean;
  reason: "not_found" | "not_host" | "already_checked_in" | null;
  guestName: string | null;
  eventId: string | null;
  checkedInAt: string | null;
};

export type Guest = {
  rsvpId: string;
  name: string;
  sfsuVerified: boolean;
  createdAt: string;
  checkedInAt: string | null;
};

// Profiles

export type Profile = {
  id: string;
  fullName: string;
  email: string | null; // from the signed-in account, read only
  sfsuVerified: boolean; // true when the account email is @sfsu.edu, read only
  major: string;
  gradYear: number | null;
  bio: string;
  linkedinUrl: string | null;
  githubUrl: string | null;
  resumeUrl: string | null;
  aiSummary: string | null;
  recruiterVisible: boolean; // the student's opt-in, off by default
};

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "fullName"
    | "major"
    | "gradYear"
    | "bio"
    | "linkedinUrl"
    | "githubUrl"
    | "resumeUrl"
    | "aiSummary"
    | "recruiterVisible"
  >
>;

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

export type ProfileSummaryResponse = { summary: string | null; reason: "no_checkins" | null };

export type EventRecapRequest = { eventId: string };
export type EventRecapStats = {
  going: number;
  checkedIn: number;
  turnoutPercent: number | null;
  verifiedGuests: number;
  foodPosts: number;
  portionsPosted: number;
  portionsClaimed: number;
};
export type EventRecapResponse = { recap: string; stats: EventRecapStats };

// One event an opted-in student checked in to.
export type AttendedEvent = {
  profileId: string;
  eventId: string;
  title: string;
  clubName: string;
  tags: string[];
  startsAt: string;
};

export type RecruiterSearchRequest = { query: string };
export type RecruiterMatch = {
  profileId: string;
  reason: string;
  evidenceEventIds: string[];
};
export type RecruiterSearchResponse = { matches: RecruiterMatch[] };
