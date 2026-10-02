// Three demo accounts to show three views of Gator Radar side by side: the owner of
// the sample club "Gator Coders", a plain member of it, and a student in no club.
// Each one is opened under its own address of the one dev server, so the three
// sign-ins never share a session. Safe to run again: it only brings the three
// accounts back to the state below. Run seed-demo.mjs first for the sample club.
//
//   node --env-file=.env.local scripts/demo-accounts.mjs
import { createClient } from "@supabase/supabase-js";

const CLUB = "Gator Coders";
const PORT = 3600;

const ACCOUNTS = [
  {
    email: "owner@demo.gatorradar.test",
    name: "Olivia Owner",
    major: "Computer Science",
    gradYear: 2026,
    level: "owner",
    origin: `http://localhost:${PORT}`,
  },
  {
    email: "member@demo.gatorradar.test",
    name: "Marco Member",
    major: "Computer Engineering",
    gradYear: 2027,
    level: "member",
    origin: `http://127.0.0.1:${PORT}`,
  },
  {
    email: "student@demo.gatorradar.test",
    name: "Sam Student",
    major: "Biology",
    gradYear: 2028,
    level: null,
    origin: `http://gator.localhost:${PORT}`,
  },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function check(step, { error }) {
  if (error) throw new Error(`${step}: ${error.message}`);
}

async function findUserIds(emails) {
  const ids = new Map();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      const email = user.email?.toLowerCase();
      if (email && emails.includes(email)) ids.set(email, user.id);
    }
    if (data.users.length < 1000) return ids;
  }
}

const { data: club, error: clubError } = await supabase
  .from("clubs")
  .select("id")
  .eq("name", CLUB)
  .maybeSingle();
if (clubError) throw clubError;
if (!club) {
  console.error(`No club named "${CLUB}". Run scripts/seed-demo.mjs first.`);
  process.exit(1);
}

const ids = await findUserIds(ACCOUNTS.map((account) => account.email));

for (const account of ACCOUNTS) {
  let id = ids.get(account.email);
  if (!id) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      email_confirm: true,
    });
    if (error) throw error;
    id = data.user.id;
  }

  check(
    `profile ${account.email}`,
    await supabase.from("profiles").upsert({
      id,
      full_name: account.name,
      major: account.major,
      grad_year: account.gradYear,
      role: "student",
      is_demo: true,
    }),
  );

  if (account.level) {
    check(
      `membership ${account.email}`,
      await supabase
        .from("club_members")
        .upsert({ club_id: club.id, uid: id, role: account.level }, { onConflict: "club_id,uid" }),
    );
  } else {
    // The plain student view: in no club at all.
    check(`clubs ${account.email}`, await supabase.from("club_members").delete().eq("uid", id));
  }
}

const width = Math.max(...ACCOUNTS.map((account) => account.email.length));
console.log("\nOpen each address in its own tab, then sign in with the code 000000:\n");
for (const account of ACCOUNTS) {
  const view = account.level ? `${account.level} of ${CLUB}` : "student in no club";
  console.log(`  ${account.origin.padEnd(30)} ${account.email.padEnd(width)}  ${view}`);
}
console.log(
  "\nPut this in .env.local with DEMO_LOGIN=1 (add any demo emails already listed there):\n",
);
console.log(`  DEMO_EMAILS=${ACCOUNTS.map((account) => account.email).join(",")}\n`);
