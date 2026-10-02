# Round 3, Host thread

Read `docs/plans/20-round3-overview.md` first.

Folder `/Users/rahazh/Documents/coding/sfhacks-food`, branch `thread/food`, dev server `npx next dev -p 3602`. Start with `git merge main` and `npm install`. Write your plan to `docs/plans/22a-host-build.md`, then build. Requests go in `docs/plans/requests-host.md`.

## You own

`src/app/post/**`, `src/components/post/**`, `src/app/host/**` except `src/app/host/analytics/**`, `src/components/host/**`.

`src/app/food/**` and `src/components/food/**` moved to the Student thread. Do not edit them.

## 1. Fix the event form

These are the user's direct complaints. Fix every one.

- **Optional means optional.** Room is optional: no "Needs input" badge, no warning. The free food checkbox never shows "Needs input". Only truly required fields that are empty get a marker, and only after the AI draft or a publish attempt.
- **AI fills once, automatically.** When a flyer is dropped or text is pasted, call `extract-event` by itself, once. No "Fill in the form" button. Show a short "Reading your flyer" state inside the form. If the user edits the notes again, offer one quiet "Re-read" link, never an automatic re-run.
- **No AI check loop.** Remove the "Checking your event" wait and the "Check again" button. Validate instantly in the browser with `checkEventDraft()` from `src/lib/checks.ts` as fields change, and show problems inline. Publish is enabled the moment there are no errors.
- **Food chips.** When "free food" is on, show chips from `FOOD_OPTIONS` (pizza, donuts, snacks and so on) and save them as `foodItems`. Remove the allergen warning text.
- **Real date and time inputs.** Replace the browser date-time fields with the shadcn `calendar` in a `popover` for the date, and a `select` (15-minute steps) for start and end time. End defaults to one hour after start.
- **Club.** A `select` of the user's clubs from `listMyClubs()` plus "Just me", saved as `clubId`. The club name fills "Club or organizer".
- **Cost.** An optional "What did it cost?" dollar field, saved as `cost`. It feeds the school report.
- `/post` is now only for events. Leftover food moves to the event (section 3).

## 2. Clubs: `/host/clubs`

- Create a club (`createClub`), join one with a code (`joinClub`, null means wrong code).
- For each of my clubs (`listMyClubs`): name, my role, the join code with a copy button, and the organizers (`listClubMembers`).
- The dashboard at `/host` groups events by club and shows which club each belongs to.

## 3. Leftover food from an event: `/host/[id]/food`

Food can only be posted from an event you manage. The database rejects anything else.

- Entry points: a gold "Post leftover food" button on the manage page, shown when the event has started.
- The flow: photo, AI estimate (`estimate-food`), editable fields, limit per student, publish with `createRescue({ eventId, ... })`. Building and room come from the event.
- **Pickups panel** for each food post (`listRescuesForEvent`, `listRescueClaims`): who is holding a portion with a countdown, who has picked up, and a code box. The organizer types the student's 4-character code and calls `confirmPickup(rescueId, code)`. Handle `not_found` and `already_picked_up`. Large targets, built for a phone at a table.
- Live: refresh when the rescue changes.

## 4. Door check-in fixes

- **Bug:** after a successful scan, the manual code field shows "Enter the 8-character code". A scan must never trigger validation on the manual field. Only validate that field when the organizer submits it.
- Check in from the guest list with `checkInGuest(rsvpId)`: a "Check in" button on each row that is not checked in yet, for students with a dead phone.
- Test camera scanning on a real phone if you can, and say plainly in your handoff whether you could.

## 5. Manage page

- Remove the AI recap card. Link to `/host/analytics` instead (built by the main thread).
- Show the event's cost and food items. Editing uses the same fixed form from section 1.

## 6. Animation pass

After everything works, run `emil-design-eng`, `animate` and `review-animations` over your files and apply the results.

## Suggested subagents

| Agent | Files |
|---|---|
| 1 | Event form: optional fields, auto AI fill, instant checks, food chips |
| 2 | Date and time picker components, club select, cost field |
| 3 | `/host/clubs` and the dashboard grouping |
| 4 | `/host/[id]/food`: post flow and pickups panel |
| 5 | Check-in fixes and the manage page |

Agents 1 and 2 both touch the event form. Agree the component boundaries in your plan before spawning.
