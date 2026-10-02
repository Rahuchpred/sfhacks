// Marks an account as a demo account, which may switch roles from the sidebar.
// Creates the account when the email has none yet.
//
//   node --env-file=.env.local scripts/demo-admin.mjs you@example.com
//   node --env-file=.env.local scripts/demo-admin.mjs you@example.com --off
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const off = process.argv.includes("--off");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !email.includes("@")) {
  console.error("Usage: node --env-file=.env.local scripts/demo-admin.mjs <email> [--off]");
  process.exit(1);
}
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function findUserId() {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) return null;
  }
}

let id = await findUserId();
if (!id) {
  if (off) {
    console.log(`No account for ${email}. Nothing to do.`);
    process.exit(0);
  }
  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  id = data.user.id;
  console.log(`Created an account for ${email}.`);
}

const { data: profile, error } = await supabase
  .from("profiles")
  .upsert({ id, is_demo: !off })
  .select("email, role, is_demo")
  .single();
if (error) throw error;

console.log(
  `${profile.email}: is_demo = ${profile.is_demo}, role = ${profile.role ?? "none yet"}.`,
);
