// Small helpers shared by the event form and the leftover food form.
import { useEffect } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

// ISO string to the "YYYY-MM-DDTHH:mm" local value a datetime-local input wants.
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseTags(value: string): string[] {
  const tags = value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}

// POSTs JSON to an AI route. Throws with the route's own error message.
export async function postJson<Req, Res>(url: string, body: Req): Promise<Res> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed (${response.status}).`);
  }
  return data as Res;
}

// Asks the browser to confirm before leaving while a form has unsaved input.
export function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
