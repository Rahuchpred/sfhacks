// Mock AI replies used when AI_MOCK=1 or no API key is set.
import type { ExtractEventResponse } from "@/lib/types";

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

export const checkEventFixture = {
  issues: [],
  questions: ["Is there any food with common allergens?"],
};

export const estimateFoodFixture = {
  items: "Cheese pizza, veggie pizza",
  portions: 14,
  dietary: ["vegetarian", "contains dairy", "contains gluten"],
  category: "perishable" as const,
};

export const profileSummaryFixture = {
  summary:
    "Shows up most for career and academic events, including a machine learning workshop and a hackathon.",
};

export const eventRecapFixture = {
  recap: "12 of 20 registered students checked in, a 60% turnout.",
};

export const recruiterSearchFixture = { matches: [] };
