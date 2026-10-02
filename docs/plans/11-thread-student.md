# Round 2, Student thread: what students see

Read `docs/plans/10-round2-overview.md` first. It has the big picture, the shared rules and what already exists.

## Where you work

| | |
|---|---|
| Folder | `/Users/rahazh/Documents/coding/sfhacks-map` |
| Branch | `thread/map` |
| Dev server | `npx next dev -p 3601` |

Start with `git merge main` and `npm install`.

## Step 1: write your plan

Write `docs/plans/11a-student-build.md`: components, which subagent builds which files, the order. Then execute.

## What you own

- `src/app/page.tsx` (the landing page, currently a redirect to `/map`)
- `src/app/map/**`, `src/components/map/**` (yours from round 1)
- `src/app/events/**`, `src/components/events/**`
- `src/app/tickets/**`, `src/components/tickets/**`
- `src/app/profile/**`, `src/components/profile/**`
- `src/components/landing/**`

## What to build

### 1. Event page: `/events/[id]`

Luma's event page layout: cover image (the flyer) on the left with the host below it, and on the right the title, date and time, place, a registration card, then the description. Reference: https://mobbin.com/screens/fb172cac-fa93-407d-bb68-1dc4a27db64d

- Load with `getEvent(id)`. Handle not found.
- Registration card: one Register button. It calls `rsvpEvent(id)`. If the student has no profile name yet, ask for it first and save with `saveMyProfile({ fullName })`.
- After registering, the card turns into the ticket: QR code, the 8-character code in text, and a Cancel registration link (`cancelRsvp`).
- Show `rsvpCount` going ("37 going"), live.
- An ended event shows "This event has ended" instead of Register.
- No flyer? Show a generated cover in purple with the title, not a broken image.
- If the event has food, a gold "Free food" badge.
- Add to calendar (downloads an .ics file built in the browser) and Copy link.
- On the map, the event detail panel links to this page.

### 2. Tickets: `/tickets`

- `listMyTickets()`: upcoming first, then past.
- Each ticket: event title, time, place, and the QR code large enough to scan from a phone screen. The QR code encodes the ticket `code` only.
- Checked-in tickets show "Checked in" with the time.
- Empty state links to the map.

### 3. Profile: `/profile`

The progsu idea: the profile fills itself from attendance.

- Editable: name, major, graduation year, short bio, LinkedIn, GitHub. Save with `saveMyProfile()`.
- Read only: email and a "Verified SFSU student" badge when `sfsuVerified` is true.
- "Events I showed up to": tickets with `checkedInAt` set, newest first. This list is the heart of the page.
- Stats: events attended, clubs met (distinct `clubName`), top tags.
- "AI summary" area: shows `profile.aiSummary` if present, with a "Write my summary" button. The main thread is building `POST /api/ai/profile-summary`; until it exists, build against this shape and stub it: request `{ }` (the server reads the signed-in user), response `{ summary: string }`. Label the result as AI-written and let the student edit it before saving.
- Recruiter visibility: one clear switch, off by default, saved as `recruiterVisible`. Plain wording about exactly what recruiters see (name, major, year, bio, links, AI summary, events attended) and that it can be turned off at any time.

### 4. Landing page: `/`

In the spirit of https://members.progsu.com: a big three-line headline, one primary button, then three short "how it works" steps and a strip of what is happening on campus right now (real events from `listUpcomingEvents()`).

- Headline direction: "show up. build your profile. get noticed." Write your own wording for SF State.
- Primary button goes to `/map`. A second link goes to `/post` for clubs.
- Real numbers only (count of upcoming events, open food posts). Do not invent statistics.
- SFSU purple and gold. No stock photos.

## Subagents (1 to 5)

| Agent | Files | Job |
|---|---|---|
| 1 | `src/app/events/**`, `src/components/events/**` | Event page, registration card, calendar file |
| 2 | `src/app/tickets/**`, `src/components/tickets/**` | Tickets page and the shared `TicketQr` component |
| 3 | `src/app/profile/**`, `src/components/profile/**` | Profile form, attendance list, stats, opt-in switch |
| 4 | `src/app/page.tsx`, `src/components/landing/**` | Landing page |

Agent 1 uses agent 2's `TicketQr`, so fix its props in your plan first. You link the map detail panel to the event page yourself.

## Requests file

`docs/plans/requests-student.md`

## Test before done

Register for an event, see the ticket on `/tickets`, cancel it, register again. Edit and save the profile. Flip the recruiter switch and reload to confirm it stuck. Open `/` and follow both buttons. Check everything at 390px wide.
