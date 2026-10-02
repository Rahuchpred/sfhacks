// Server-only AI client. Every AI route goes through generateJson().
import { GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import type { z } from "zod";

export const AI_MODEL = process.env.AI_MODEL ?? "gemma-4-31b-it";

export function isMock(): boolean {
  return process.env.AI_MOCK === "1" || !process.env.GEMINI_API_KEY;
}

let client: GoogleGenAI | null = null;
export function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Only images from our own storage bucket are fetched, so a caller cannot
// make the server request arbitrary URLs.
async function imagePart(imageUrl: string): Promise<Part> {
  const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
  if (!imageUrl.startsWith(allowedPrefix)) {
    throw new Error("Image must be uploaded to the app's storage first.");
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not load image (${res.status}).`);
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { inlineData: { mimeType: res.headers.get("content-type") ?? "image/jpeg", data } };
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Model returned no JSON object.");
  return JSON.parse(text.slice(start, end + 1));
}

// A call that takes longer than this is given up, so a page never waits forever.
const AI_TIMEOUT_MS = 60_000;

type GenerateJsonOptions<T> = {
  prompt: string;
  imageUrl?: string;
  schema: z.ZodType<T>;
  fixture: T;
};

// Gemma 4 supports JSON mode, so the reply is JSON by construction. It is
// still validated with zod, and one retry feeds the validation error back.
export async function generateJson<T>({
  prompt,
  imageUrl,
  schema,
  fixture,
}: GenerateJsonOptions<T>): Promise<T> {
  if (isMock()) return fixture;

  const image = imageUrl ? [await imagePart(imageUrl)] : [];

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote = lastError
      ? `\n\nYour previous reply was invalid: ${lastError}\nReply again with only the corrected JSON object.`
      : "";
    const response = await getClient().models.generateContent({
      model: AI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt + retryNote }, ...image] }],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        // The model's long thinking step made answers take from 20 seconds to minutes.
        // These are short reading and writing jobs, so it is skipped.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
      },
    });
    try {
      return schema.parse(extractJson(response.text ?? ""));
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 500) : "invalid JSON";
    }
  }
  throw new Error(`AI reply could not be parsed: ${lastError}`);
}

// A short message for the page. The model's own error text is long and technical, so it
// goes to the server log only.
export function aiErrorResponse(error: unknown): Response {
  const raw = error instanceof Error ? error.message : String(error);
  console.error("AI request failed:", raw.slice(0, 800));
  const name = error instanceof Error ? error.name : "";
  if (/429|quota|RESOURCE_EXHAUSTED|rate limit/i.test(raw)) {
    return Response.json(
      { error: "The AI is busy right now. Try again in a minute." },
      { status: 503 },
    );
  }
  if (name === "TimeoutError" || name === "AbortError" || /timed? ?out|aborted/i.test(raw)) {
    return Response.json({ error: "The AI took too long. Try again." }, { status: 504 });
  }
  const safe = raw.length <= 120 && !raw.includes("{") ? raw : "The AI request failed. Try again.";
  return Response.json({ error: safe }, { status: 500 });
}
