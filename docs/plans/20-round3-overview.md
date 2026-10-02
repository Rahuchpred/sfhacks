# Round 3: the big picture

Read this first. It is the shared context for all three threads. Rounds 1 and 2 are merged on `main` and working: map, posting, free food, RSVP with QR tickets, door check-in, profiles, recruiter search.

## Why this round exists

The user tested the app and found real problems. This round fixes them and adds the organizer side properly.

### Mistakes to fix (do not repeat these anywhere)

1. A field marked "optional" showed a "Needs input" badge and a warning. Optional means no badge, no warning. An unchecked checkbox is a valid "no".
2. AI ran on a button press and re-ran slow checks in a loop. AI must run once, automatically. Validation must be instant.
3. After a successful QR scan, the manual code field showed an error.
4. Students could claim food and never pick it up.
5. Anyone could post food with no source behind it.
6. Small nav links in a top bar were hard to use, and the UI felt flat.
7. Map pins only showed a number, so you could not match a pin to the list.
8. Browser-default date pickers and plain number boxes. Every date, time, year and choice needs a real component.
9. The landing page copied another site and had too much text.

### Decisions the user made

- **Posting an event:** dropping a flyer or pasting text fills the form once, automatically. No "Fill in" button, no "Check again" button, no AI check before publishing. Checks are instant code.
- **Food at an event:** chosen with chips (pizza, donuts, snacks and so on), not a free-text allergen warning.
- **Posting leftover food:** only from an event you manage. Enforced in the database.
- **Claiming food:** a claim is a 15-minute hold with a 4-character pickup code. The poster confirms the pickup. Unconfirmed holds return to the list.
- **Navigation:** a left sidebar with icons (the main thread builds it).
- **Organizers:** clubs with members. Any organizer of a club can manage its events. People join with a code.
- **Analytics for organizers:** real data and charts first (major, year, names, turnout and more), AI insights on top of the data.
- **School reporting:** organizers export attendance, people and cost for the school.
- **Clubs directory:** a public page listing every club and its events.
- **Landing page:** minimal, in the style of cursor.com, very little text.

## Who builds what

| Thread | Folder | Branch | Port | Brief |
|---|---|---|---|---|
| Student | `/Users/rahazh/Documents/coding/sfhacks-map` | `thread/map` | 3601 | `21-thread-student.md` |
| Host | `/Users/rahazh/Documents/coding/sfhacks-food` | `thread/food` | 3602 | `22-thread-host.md` |
| Main | `/Users/rahazh/Documents/coding/sfhacks-new` | `main` | 3600 | `23-thread-main.md` |

## Pages and owners

| Route | What | Owner |
|---|---|---|
| `/` | Landing page | Student |
| `/map` | Campus map | Student |
| `/food` | Claim free food (moved to Student this round) | Student |
| `/clubs`, `/clubs/[id]` | Clubs directory and club page | Student |
| `/events/[id]`, `/tickets`, `/profile` | Event page, tickets, profile | Student |
| `/post` | Create an event | Host |
| `/host`, `/host/[id]`, `/host/[id]/check-in` | Dashboard, manage, door | Host |
| `/host/clubs` | Create and join clubs, organizers, join code | Host |
| `/host/[id]/food` | Post leftover food from an event, confirm pickups | Host |
| `/host/analytics` | Charts, AI insights, school export | Main |
| `/recruiters` | Unchanged | Main |
| App shell and sidebar | Navigation | Main |

## What already exists on `main` (built and tested)

Run `git merge main` and `npm install`, then read `src/lib/contracts.md` and `src/lib/types.ts`. New in `src/lib/db.ts`:

- **Clubs:** `listClubs()`, `getClub(id)`, `listClubEvents(clubId)`, `createClub(name)`, `joinClub(code)` (null on a wrong code), `listMyClubs()` (includes `joinCode` and `role`), `listClubMembers(clubId)`
- **Events:** `CampusEvent` now has `clubId`, `foodItems` and `cost`. `createEvent` and `updateEvent` accept them. `listMyHostedEvents()` now includes events of clubs you organize. Any organizer of the club can edit, delete, check in and see guests
- **Food options:** `FOOD_OPTIONS` in `src/lib/checks.ts`
- **Leftover food:** `createRescue` is rejected by the database unless `eventId` is an event you manage. `listRescuesForEvent(eventId)`
- **Claims:** `claimPortion(id)` now returns `claimCode` and `expiresAt`. `listMyClaims()` returns `MyClaim[]` (code, expiresAt, pickedUpAt). `releaseExpiredClaims()` puts expired holds back, call it when the food page loads. `confirmPickup(rescueId, code)` and `listRescueClaims(rescueId)` are for the poster
- **Door:** `checkInGuest(rsvpId)` checks a guest in from the guest list (dead phone)
- **Analytics data:** `listHostAttendance()`: one row per registration across the events you manage, with name, major, year, verified, registered and checked-in times

New shadcn components in `src/components/ui`: `calendar`, `popover`, `select`, `chart`, `sidebar`, `tooltip`, `avatar`, `progress`, `separator`, plus `toggle` and `switch` from before.

## Design rules for this round

- **Use Mobbin before designing any screen.** Call `mcp__mobbin__search_screens` (platform `web`) for a real reference, and name the reference in a comment at the top of the component. This is required, not optional.
- Desktop website first. Every page must also work at 390px wide.
- Purple (`bg-primary`) for events, gold (`bg-accent` with `text-accent-foreground`) for food.
- No browser-default date, time or number pickers. Dates use the shadcn `calendar` in a `popover`. Times, years and fixed choices use `select` or chips.
- Less text. Labels over sentences. Never explain what the UI already shows.
- Every button gives feedback when pressed. Every list has loading, empty and error states.
- **Animation pass at the end of your work:** run the `emil-design-eng`, `animate` and `review-animations` skills over your files and apply what they recommend. Motion should be fast and purposeful, and must respect reduced-motion.

## Rules for every thread

- Plan first: write a short build plan in `docs/plans/`, then execute without waiting for approval.
- Use 1 to 5 subagents, only for pieces that touch different files.
- Stay in your folder and on your branch.
- Frozen files change only on `main`: `src/lib/**`, `supabase/migrations`, `src/components/ui/**`, `src/components/app-shell.tsx`, `src/components/auth-provider.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/api/**`, `package.json`. Need a change? Write it in your requests file, tell the user, and stub it meanwhile.
- Never use port 3000 or 3600. Check `AGENTS.md`: this Next.js version has breaking changes.
- Before saying done: `npx tsc --noEmit` and `npx eslint src` pass, you clicked through every feature in a browser at 1440px and 390px wide, and you ran the `web-design-guidelines` skill on your files.
- Delete test rows you create.
- No em dashes or en dashes anywhere, in code, comments or UI text.
- Commit to your branch at each working checkpoint. Do not push, do not open a PR. When ready, tell the user "<branch> is ready to merge" with a one-line summary.
- End commit messages with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
