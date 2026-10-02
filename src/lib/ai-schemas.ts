// zod schemas for AI route output. Keep in sync with src/lib/types.ts.
import { z } from "zod";

const nullableString = z.string().nullable().catch(null);

export const eventDraftSchema = z.object({
  title: nullableString,
  description: nullableString,
  clubName: nullableString,
  buildingId: nullableString,
  room: nullableString,
  startsAt: nullableString,
  endsAt: nullableString,
  tags: z.array(z.string()).catch([]),
  hasFood: z.boolean().nullable().catch(null),
  foodItems: z.array(z.string()).catch([]),
});

export const extractEventSchema = z.object({
  event: eventDraftSchema,
  missing: z.array(z.string()).catch([]),
  confidence: z.number().min(0).max(1).catch(0.5),
});

// Model output only. The route merges this with the code checks in src/lib/checks.ts.
export const checkEventSchema = z.object({
  issues: z
    .array(z.object({ field: z.string(), message: z.string() }))
    .catch([]),
  questions: z.array(z.string()).catch([]),
});

// Model output only. The route computes safeUntil from the category.
export const estimateFoodSchema = z.object({
  items: z.string(),
  portions: z.number().int().positive(),
  dietary: z.array(z.string()).catch([]),
  category: z.enum(["perishable", "shelf_stable"]).catch("perishable"),
});

export const profileSummarySchema = z.object({ summary: z.string().min(1) });

export const eventRecapSchema = z.object({ recap: z.string().min(1) });

export const recruiterSearchSchema = z.object({
  matches: z
    .array(
      z.object({
        profileId: z.string(),
        reason: z.string(),
        evidenceEventIds: z.array(z.string()).catch([]),
      }),
    )
    .catch([]),
});

export const hostInsightsSchema = z.object({
  insights: z.array(z.object({ title: z.string(), detail: z.string() })).min(1).max(6),
  nextEvent: z.string().catch(""),
});

export const structureHelpSchema = z.object({
  title: z.string().min(1),
  description: z.string().catch(""),
  timeNeeded: z.string().catch(""),
  skills: z.array(z.string()).catch([]),
  rewardType: z.string().nullable().catch(null),
  rewardDetail: z.string().catch(""),
  buildingId: z.string().nullable().catch(null),
});

export const safetyNoticesSchema = z.object({
  notices: z
    .array(
      z.object({
        title: z.string(),
        category: z.string(),
        occurredOn: z.string().nullable().catch(null),
        area: z.string().catch(""),
        buildingId: z.string().nullable().catch(null),
        summary: z.string(),
        sensitive: z.boolean().catch(true),
      }),
    )
    .catch([]),
});
