# Round 2, Main thread: accounts, data, AI, recruiters

Folder `/Users/rahazh/Documents/coding/sfhacks-new`, branch `main`, port 3600. See `10-round2-overview.md` for the big picture.

## Done already

- Tables `profiles` and `rsvps`, counters on `events`, and the functions `rsvp_event`, `cancel_rsvp`, `check_in`, `event_guests`, with row level security. Tested against the live database.
- `src/lib/types.ts` and `src/lib/db.ts` for tickets, check-in, hosting and profiles.
- QR libraries installed.

## To do, in order

1. **Navigation.** Shell links: Map, Free food, Tickets, Host, Post, and a profile link. Keep it one row on desktop, a menu on a phone.
2. **Sign-in.** Google sign-in limited to SFSU accounts, upgrading the anonymous user so existing tickets stay attached. `profile.sfsuVerified` is set by a database trigger from the account email, so a client cannot fake it. Needs the user to create a Google OAuth client and paste it into Supabase.
3. **AI: profile summary.** `POST /api/ai/profile-summary`. Reads the signed-in user's checked-in events on the server and writes a short summary. Rules in the prompt: only events with a check-in, no invented skills, no claims about ability, plain language. Response `{ summary }`. The student edits and saves it.
4. **AI: event recap.** `POST /api/ai/event-recap`, `{ eventId }`. Host only. Numbers (going, checked in, turnout rate, food posted) are computed in code and passed in. The model only writes the sentences. Response `{ recap }`.
5. **AI: recruiter search.** `POST /api/ai/recruiter-search`, `{ query }`. Loads only opted-in profiles with their attended events, asks the model to rank them against the query and cite which attended events support each match. Ids are validated against the loaded list, so the model cannot surface a student who did not opt in. Response `{ matches: [{ profileId, reason, evidenceEventIds }] }`.
6. **Recruiter page.** `/recruiters`: a search box, ranked cards with the reason and the supporting events, and a plain note that only opted-in students appear.
7. **Eval.** Extend `scripts/eval.mjs` with cases for the three new routes.
8. **Integration.** Answer `requests-student.md` and `requests-host.md`, merge both branches, full click-through of the whole loop: register, scan, profile updates, recruiter finds the student.
9. **README, responsible-AI notes, demo script.**

## Responsible AI points this round adds

- Recruiters see a student only after an explicit opt-in, enforced in the database, not just in the UI.
- Profile claims come from scanned check-ins, not self-report, and the AI may not add skills that are not evidenced.
- AI-written text is always labeled and editable before it is saved.
- Ranking shows its evidence, so a recruiter can see why a student matched.
