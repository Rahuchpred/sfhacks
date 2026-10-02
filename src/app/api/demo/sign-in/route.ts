// Demo sign-in, for testing and for the live demo without waiting on an email.
// It only exists when DEMO_LOGIN=1, and only for the emails in DEMO_EMAILS
// (comma separated). Those emails skip the real email and sign in with a fixed
// code instead (DEMO_CODE, "000000" by default). Leave DEMO_LOGIN unset on any
// deployment that should not allow this.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { userFromRequest } from "@/lib/supabase/server";

type DemoRequest = { email?: string; code?: string };

function demoEnabled(): boolean {
  return process.env.DEMO_LOGIN === "1" && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function isDemoEmail(email: string): boolean {
  return (process.env.DEMO_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

function notFound(): Response {
  return Response.json({ error: "Not found." }, { status: 404 });
}

// Tells the onboarding whether to ask this route before sending a real email.
export async function GET() {
  return Response.json({ enabled: demoEnabled() });
}

export async function POST(request: Request) {
  if (!demoEnabled()) return notFound();

  const body = (await request.json().catch(() => ({}))) as DemoRequest;
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!isDemoEmail(email)) return notFound();

  // First call: the email is a demo email, so no real email is needed.
  if (body.code === undefined) return Response.json({ demo: true });

  if (body.code !== (process.env.DEMO_CODE ?? "000000")) {
    return Response.json({ error: "Wrong code." }, { status: 400 });
  }

  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);

  // Like the real path: a guest keeps their tickets and claims by adding the
  // email to the anonymous account. That fails when the email already has an
  // account, and then that account is used.
  const guest = await userFromRequest(request);
  if (guest && !guest.user.email) {
    await admin.auth.admin.updateUserById(guest.user.id, { email, email_confirm: true });
  } else {
    await admin.auth.admin.createUser({ email, email_confirm: true });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link.properties?.hashed_token) {
    return Response.json({ error: "Could not sign in." }, { status: 500 });
  }

  const client = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
  const { data, error } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (error || !data.session) {
    return Response.json({ error: "Could not sign in." }, { status: 500 });
  }

  return Response.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
}
