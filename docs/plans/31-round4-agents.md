# Round 4: decisions and agent briefs

Read `docs/plans/25-agent-rules.md` first. It still applies, with the changes in "Ownership in round 4" below. Background and research: `docs/plans/30-onboarding-and-ai.md`. The user's "do not repeat" list: `docs/plans/20-round3-overview.md`.

## Decisions from the user

- Roles: locked roles for real users, plus a hidden demo switch for the owner's account.
- Open to everyone, even without signing in: Map, events, Free food, Clubs, Safety notices.
- Sign-in: SFSU email code. Recruiters: any email, and they only see students who opted in.
- Onboarding must be short and minimal.
- AI to build: turnout and food forecast, clash check against real class schedules, and a voice event planner that joins both: the host talks about the idea, speech becomes text on the device, and the app proposes rooms that are free, big enough, and at a time with few clashes.
- A simple daily report of every event (going, checked in) in a format that pastes into Google Sheets. Not official.
- Not wanted: policy check, AI drafting of help requests.

## Ownership in round 4

Four agents, each in its own worktree. Shared files are split like this:

| Agent | Port | Owns |
|---|---|---|
| A roles | 3611 | `src/components/app-shell.tsx`, `src/components/auth-provider.tsx`, `src/components/onboarding/**`, `src/app/welcome/**`, `src/lib/roles.ts`, the profile parts of `src/lib/db.ts` and `src/lib/types.ts`, `src/app/api/ai/recruiter-search/**`, `src/app/api/demo/**`, `src/components/profile/**`, `scripts/demo-admin.mjs`, migration `20261003000000_roles.sql` |
| B campus data | 3612 | `src/lib/planner.ts`, `src/lib/db-planner.ts`, `src/lib/planner-ai.ts`, `src/app/api/planner/**`, `src/app/api/ai/plan-event/**`, `scripts/load-classes.mjs`, `scripts/eval.mjs`, migration `20261003010000_rooms_classes.sql` |
| C planner UI | 3613 | `src/components/planner/**`, `src/app/plan/**`, `src/components/post/**`, `src/app/post/**` |
| D reports | 3614 | `src/components/reports/**`, `src/app/host/reports/**`, `src/lib/reports.ts`, `src/components/help/**`, `src/app/help/**`, `src/app/api/ai/structure-help/**`, `src/app/api/ai/event-recap/**` |

- `src/lib/planner-types.ts` is the frozen contract between B and C. Nobody edits it.
- You may add an npm package you really need. Say which in your report.
- A and B push their own migration with `supabase db push --yes` (add `--include-all` if it complains about order). Do not regenerate `src/lib/database.types.ts`: the main thread does it after the merge. Until then, cast in your own files.
- Never delete rows you did not create. Name test rows "ZZ4 <your letter> ...".
- Sign-in emails are limited to a few per hour. Do not test by sending real emails more than twice. Agent A builds a demo sign-in path for testing.

## Agent A: onboarding and roles

Mobbin references already chosen (name them in the component comment):
- Role step: Notion "How do you want to use Notion?", three stacked cards with an icon, a title and one grey line. https://mobbin.com/screens/99396b7b-c21d-4cea-8956-4942c2b9aae6
- Code step: v0 sign up, six single-digit boxes. https://mobbin.com/flows/b91dcea0-af15-4792-9361-c6d4a645a982
- Layout: Tally onboarding, one narrow centered column, nothing else on the page. https://mobbin.com/flows/4ad8acc8-87b1-4bf6-9a97-58aff989c810

Flow at `/welcome`, three short steps, full width with no sidebar (like the landing):
1. "Who are you?" Student, Faculty or staff, Recruiter. One click continues.
2. Email, then the code. Student and Faculty need `@sfsu.edu` or `@mail.sfsu.edu`. Recruiter can use any email. Use `supabase.auth.signInWithOtp` and `verifyOtp`. If the visitor has an anonymous session, keep their tickets and claims (link the email to the same user if Supabase allows it).
3. One screen by role. Student: name, major, graduation year (reuse the pickers in `src/components/profile`), and a "Visible to recruiters" switch, off by default. Faculty: name and department. Recruiter: name and company. Then go to the right home page.

Roles:
- `profiles.role`: `student`, `faculty`, `recruiter`, null for guests. Set once through a security definer function, not writable from the client afterwards. Add `visible_to_recruiters` and `is_demo`.
- Guests keep the anonymous session and can browse the open pages. Register, claim food, post, help board and profile send a guest to `/welcome`, then back to where they were.
- Sidebar: "Explore" (Map, Free food, Clubs, Safety notices) for everyone. Student: My tickets, Help board. "For clubs" appears only for a student or faculty member who is in a club, plus one "Start a club" link otherwise. Add `/plan` "Plan an event" and `/host/reports` "Reports" to "For clubs". Faculty: Ask for help, My requests. Recruiter: Find students. Guests see a "Sign in" button in the footer.
- Guard pages by path in the app shell so pages owned by other agents need no edits. Enforce in the database too: recruiter search returns only `visible_to_recruiters` students and only to a recruiter, help requests can be created only by faculty.
- Demo: `scripts/demo-admin.mjs <email>` marks an account `is_demo`. A demo account sees a small role switcher in the sidebar footer that really changes its role through a function that checks `is_demo`. Also a demo sign-in for testing without email: a server route that works only when `DEMO_LOGIN=1` and only for emails listed in `DEMO_EMAILS`, using the service role to create the session. Document both in the report.

## Agent B: campus data, forecast, clash check, planner API

1. Tables: `rooms` (building_id, room, capacity, kind) and `class_sections` (subject, number, title, building_id, room, days, start and end time, term, enrolled, capacity). Public read.
2. `scripts/load-classes.mjs`: load the real schedule from https://webapps.sfsu.edu/public/classservices/classsearch (public; the advanced search can filter by building). A plain form post answered "session expired", so drive the real form with `playwright-core`, locally or through Browserbase (`BROWSERBASE_API_KEY` is in `.env.local`, see the note in `30-onboarding-and-ai.md`). Be polite: a few subjects, slow requests. Map building names to our `buildings` ids. If it cannot be done, generate a realistic sample for our 19 buildings and mark it as sample data everywhere (`source.sample = true`). Room capacity: use the largest class capacity seen in that room.
3. `src/lib/planner.ts`, pure code with no AI:
   - Forecast from past check-ins of the club, then tag, building, weekday and hour, with sensible fallbacks when there is little history. Low, high, confidence, food portions.
   - Free rooms: a room is free when no class section and no event uses it in that window.
   - Clashes: classes and events at the same time that pull the same audience. Audience comes from the majors of the club's past attendees matched to class subjects, and from event tags.
   - Score and rank slots.
4. Routes, shapes in `src/lib/planner-types.ts`:
   - `POST /api/planner/check`: code only, instant.
   - `POST /api/ai/plan-event`: Gemma turns the transcript into an `EventIdea` (JSON mode, zod, one retry, fixture under `AI_MOCK=1`, same pattern as `src/lib/ai.ts`), code finds and ranks options, then one AI call writes the short reasons from the facts. AI never invents a room, a time or a number.
5. Add eval cases to `scripts/eval.mjs` for the idea extraction and for the forecast math.

## Agent C: voice planner and forecast on the post form

Build against `src/lib/planner-types.ts`. Until B is merged the routes do not exist: build a small mock behind one function so the switch is a one-line change, and say so in the report.

1. `/plan` "Plan an event": one big microphone button and a text box as the fallback. Speech to text must run on the device: use Whisper in the browser through `@huggingface/transformers` (small English model, loaded on first use, with a visible loading state). If that is impossible, fall back to the browser Web Speech API and say so. Show the live transcript, editable.
2. When the host stops talking, call `/api/ai/plan-event` once, automatically. Show what was understood (title, tags, people, duration), the forecast, and up to three option cards: building, room, capacity, time, clashes, reason. A badge shows when the schedule is sample data.
3. "Use this" opens the post form filled in with the idea and the chosen option.
4. On the post form: a quiet forecast and clash card that calls `/api/planner/check` when building and time are set (debounced, code only, never blocks posting). Better slots are one click to apply.
5. Mobbin references for each screen, and the motion pass from the rules file.

## Agent D: reports, and removing AI drafting

1. `/host/reports`: every event the host manages, grouped by day. Columns: date, event, club, building, registered, checked in, turnout, food posted, food claimed, cost. Day totals.
2. Export in the shape of a form-response sheet, one row per event and a second table with one row per check-in: "Copy for Google Sheets" (tab-separated text to the clipboard), "Download CSV", and a clean print view. Reuse `src/lib/analytics.ts` and existing `db.ts` functions. No Google account connection.
3. Help board: remove the AI drafting from the request form so it is a plain short form. Delete the `structure-help` and `event-recap` routes if nothing else uses them.

## Merge order

A, then B, then D, then C. The main thread regenerates database types, switches C from the mock to the real routes, and does a full click-through.
