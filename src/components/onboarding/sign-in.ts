// The email sign-in used by the onboarding. The email holds a code or, while the
// project uses Supabase's default template, a link that opens the welcome page. A guest's anonymous account
// gets the email added to it, so their tickets and claims stay with them.
import { isSfsuEmail } from "@/lib/roles";
import { supabase } from "@/lib/supabase/client";

// "email_change": the code adds the email to the guest's account.
// "email": the email already has an account, so the code signs in to it.
// "demo": a demo email, checked by our own route with no email sent.
export type CodeKind = "email_change" | "email" | "demo";

const DEMO_ROUTE = "/api/demo/sign-in";

type AuthError = { code?: string; status?: number; message: string };

function sendError(error: AuthError): Error {
  if (error.status === 429 || error.code?.includes("rate_limit")) {
    return new Error("Too many emails right now. Try again in a few minutes.");
  }
  return new Error("Could not send the code. Try again.");
}

async function demoPost(body: { email: string; code?: string }): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(DEMO_ROUTE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// True only where the owner turned the demo sign-in on.
export async function demoSignInEnabled(): Promise<boolean> {
  try {
    const response = await fetch(DEMO_ROUTE);
    const result = (await response.json()) as { enabled?: boolean };
    return result.enabled === true;
  } catch {
    return false;
  }
}

export async function sendCode(
  email: string,
  options: { demo: boolean; needsSfsu: boolean; redirectTo: string },
): Promise<CodeKind> {
  if (options.demo) {
    const response = await demoPost({ email }).catch(() => null);
    if (response?.ok) return "demo";
  }
  if (options.needsSfsu && !isSfsuEmail(email)) throw new Error("Use your SFSU email.");

  const { data } = await supabase.auth.getSession();
  if (data.session && !data.session.user.email) {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: options.redirectTo },
    );
    if (!error) return "email_change";
    if (error.code !== "email_exists" && !/already/i.test(error.message)) throw sendError(error);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: options.redirectTo },
  });
  if (error) throw sendError(error);
  return "email";
}

export async function verifyCode(email: string, code: string, kind: CodeKind): Promise<void> {
  if (kind === "demo") {
    const response = await demoPost({ email, code });
    const result = (await response.json().catch(() => null)) as {
      accessToken?: string;
      refreshToken?: string;
      error?: string;
    } | null;
    if (!response.ok || !result?.accessToken || !result.refreshToken) {
      throw new Error(response.status === 400 ? "That code is not right." : "Could not sign in. Try again.");
    }
    const { error } = await supabase.auth.setSession({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
    if (error) throw new Error("Could not sign in. Try again.");
    return;
  }

  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: kind });
  if (error) {
    throw new Error(
      error.status === 429 ? "Too many tries. Wait a minute." : "That code is wrong or expired.",
    );
  }
}
