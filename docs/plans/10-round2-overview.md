# Round 2: the big picture

Read this first. It is the shared context for all three threads.

## Where the product is now

Gator Radar is a website for SF State. Round 1 is merged and working on `main`:

- `/map`: live campus map with event pins, search and filters
- `/post`: a club posts an event from a flyer or rough text (AI drafts it, exact code rules check it), or posts leftover food from a photo
- `/food`: students claim leftover food, with a per-student limit set by the poster
- AI: Google Gemma 4 through the Gemini API. Stack: Next.js, shadcn/ui, Supabase, MapLibre

## Where round 2 takes it

The loop we are building, inspired by https://members.progsu.com and by Luma:

1. A student signs in once.
2. They register for an event and get a QR ticket.
3. The club scans the ticket at the door.
4. Every check-in lands on the student's profile automatically. No forms.
5. Recruiters can find students by what they actually showed up to, but only students who opted in.

The one-line pitch: **show up, and your profile builds itself.**

Why this matters for judging: clubs get real turnout numbers, students get a profile without effort, and the AI works from verified attendance instead of self-reported claims.

## Who builds what

| Thread | Folder | Branch | Port | Side of the product | Brief |
|---|---|---|---|---|---|
| Student | `/Users/rahazh/Documents/coding/sfhacks-map` | `thread/map` | 3601 | What students see | `11-thread-student.md` |
| Host | `/Users/rahazh/Documents/coding/sfhacks-food` | `thread/food` | 3602 | What clubs see | `12-thread-host.md` |
| Main | `/Users/rahazh/Documents/coding/sfhacks-new` | `main` | 3600 | Accounts, data, AI, recruiters, merging | `13-thread-main.md` |

## Pages after round 2

| Route | What | Owner |
|---|---|---|
| `/` | Landing page | Student |
| `/map` | Campus map (exists) | Student |
| `/events/[id]` | Event page with Register | Student |
| `/tickets` | My tickets, each with a QR code | Student |
| `/profile` | My profile, attendance history, recruiter opt-in | Student |
| `/host` | Club dashboard: my events and turnout | Host |
| `/host/[id]` | Manage one event: guest list, edit, cancel | Host |
| `/host/[id]/check-in` | Scan tickets at the door | Host |
| `/post` | Create an event or post food (exists, being restructured) | Host |
| `/food` | Claim free food (exists) | Host |
| `/recruiters` | Search opted-in students | Main |

## What already exists for you (built on `main`, tested)

The database and data functions for round 2 are done. Run `git merge main` and read `src/lib/contracts.md`. In short, `src/lib/db.ts` now has:

- Events: `getEvent`, `listMyHostedEvents`, `updateEvent`, `deleteEvent`. `CampusEvent` has live `rsvpCount` and `checkedInCount`
- Tickets: `rsvpEvent`, `cancelRsvp`, `getMyTicket`, `listMyTickets`
- Door: `checkIn(code)`, `listGuests(eventId)`. Both work only for the person who created the event
- Profiles: `getMyProfile`, `saveMyProfile`, `listRecruiterVisibleProfiles`

Installed libraries: `qrcode.react` (draw a QR code) and `@yudiel/react-qr-scanner` (scan with the camera).

## Sign-in, for now

Every visitor is still signed in anonymously, and all the functions above work for anonymous users. So nothing is blocked. The main thread is adding real sign-in limited to SFSU accounts. When it lands, `profile.sfsuVerified` becomes true for those users. Build your screens so they work in both cases: show a "Verified SFSU student" badge when `sfsuVerified` is true, and nothing when it is false.

A ticket needs a name for the guest list. If the student has no profile yet, ask for their name when they register and save it with `saveMyProfile({ fullName })`.

## Design

- Desktop website first. Every page must also stack cleanly on a phone, because tickets are shown and scanned on phones.
- Purple (`bg-primary`) for events, gold (`bg-accent` with `text-accent-foreground`) for food.
- shadcn components from `src/components/ui`. Geist font.
- Borrow layout patterns from Luma and progsu, not their code, images or wording. Use the Mobbin tools (`mcp__mobbin__search_screens`, `mcp__mobbin__search_flows`) to look at references before designing a screen.
- Tone: short, plain, lowercase-friendly like progsu. No marketing fluff.

## Rules for every thread

- Plan first: write a short build plan in `docs/plans/`, then execute without waiting for approval.
- Use 1 to 5 subagents, only for pieces that touch different files.
- Stay in your folder and on your branch. Do not edit another thread's files or the frozen files.
- Frozen files change only on `main`: `src/lib/types.ts`, `src/lib/db.ts`, `src/lib/use-campus.ts`, `supabase/migrations`, `src/components/ui/**`, `src/components/app-shell.tsx`, `src/components/auth-provider.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/api/**`, `package.json`.
- Need a frozen change? Write it in your requests file, tell the user, and build against a local stub meanwhile.
- Never use port 3000 or 3600. Check `AGENTS.md`: this Next.js version has breaking changes.
- Before saying done: `npx tsc --noEmit` and `npx eslint src` pass, you clicked through every feature in a browser at 1440px and 390px wide, and you ran the `web-design-guidelines` skill on your files.
- Delete any test rows you create.
- No em dashes or en dashes anywhere, in code, comments or UI text.
- Commit to your branch at each working checkpoint. Do not push, do not open a PR. When ready, tell the user "<branch> is ready to merge" with a one-line summary.
- End commit messages with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
