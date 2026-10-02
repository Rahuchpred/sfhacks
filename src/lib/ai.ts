// Server-only AI client. Every AI route goes through generateJson().
import { GoogleGenAI, type Part } from "@google/genai";
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
      config: { temperature: 0.2, responseMimeType: "application/json" },
    });
    try {
      return schema.parse(extractJson(response.text ?? ""));
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 500) : "invalid JSON";
    }
  }
  throw new Error(`AI reply could not be parsed: ${lastError}`);
}

export function aiErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "AI request failed.";
  return Response.json({ error: message }, { status: 500 });
}
