// Client helper for calling our API routes as the signed-in user.
import { supabase } from "@/lib/supabase/client";

export async function postJson<T>(path: string, body: unknown = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error ?? "Something went wrong. Try again.");
  }
  return result as T;
}
