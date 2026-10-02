// Mock AI replies used when AI_MOCK=1 or no API key is set.
import type {
  CheckEventResponse,
  EstimateFoodResponse,
  ExtractEventResponse,
} from "@/lib/types";

export const extractEventFixture: ExtractEventResponse = {
  event: {
    title: "Boba and Board Games Night",
    description: "Free boba, board games and a chance to meet the club. All majors welcome.",
    clubName: "Asian Student Union",
    buildingId: "cesar-chavez",
    room: "Rosa Parks A-C",
    startsAt: "2026-10-08T17:00:00-07:00",
    endsAt: "2026-10-08T19:00:00-07:00",
    tags: ["social", "cultural", "free food"],
    hasFood: true,
  },
  missing: [],
  confidence: 0.86,
};

export const checkEventFixture: CheckEventResponse = {
  ok: false,
  issues: [
    {
      field: "startsAt",
      message: "The flyer says Thursday, Oct 9, but Oct 9, 2026 is a Friday.",
      severity: "error",
    },
  ],
  questions: ["Is there any food with common allergens?"],
};

export const estimateFoodFixture: EstimateFoodResponse = {
  items: "Cheese pizza, veggie pizza",
  portions: 14,
  dietary: ["vegetarian", "contains dairy", "contains gluten"],
  safeUntil: "2026-10-02T15:30:00-07:00",
  note: "Hot food is safe for about 2 hours at room temperature.",
};
