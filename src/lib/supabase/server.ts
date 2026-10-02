// Server-side Supabase client that acts as the signed-in user, so row level
// security applies to everything an API route reads.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type UserContext = { supabase: SupabaseClient<Database>; user: User };

export async function userFromRequest(request: Request): Promise<UserContext | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return null;

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export function notSignedIn(): Response {
  return Response.json({ error: "Sign in first." }, { status: 401 });
}
