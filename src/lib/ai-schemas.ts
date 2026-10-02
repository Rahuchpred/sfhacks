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
});

export const extractEventSchema = z.object({
  event: eventDraftSchema,
  missing: z.array(z.string()).catch([]),
  confidence: z.number().min(0).max(1).catch(0.5),
});

export const checkEventSchema = z.object({
  ok: z.boolean(),
  issues: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
        severity: z.enum(["error", "warn"]).catch("warn"),
      }),
    )
    .catch([]),
  questions: z.array(z.string()).catch([]),
});

export const estimateFoodSchema = z.object({
  items: z.string(),
  portions: z.number().int().positive(),
  dietary: z.array(z.string()).catch([]),
  safeUntil: z.string(),
  note: z.string().catch(""),
});
