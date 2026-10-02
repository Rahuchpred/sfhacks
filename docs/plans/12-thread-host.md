# Round 2, Host thread: what clubs see

Read `docs/plans/10-round2-overview.md` first. It has the big picture, the shared rules and what already exists.

## Where you work

| | |
|---|---|
| Folder | `/Users/rahazh/Documents/coding/sfhacks-food` |
| Branch | `thread/food` |
| Dev server | `npx next dev -p 3602` |

Start with `git merge main` and `npm install`. Note: the main thread changed `src/components/food/**` and `src/components/post/food-form.tsx` during the last merge (a per-student claim limit). Read those changes before editing those files.

## Step 1: write your plan

Write `docs/plans/12a-host-build.md`: components, which subagent builds which files, the order. Then execute.

## What you own

- `src/app/host/**`, `src/components/host/**`
- `src/app/post/**`, `src/components/post/**` (yours from round 1)
- `src/app/food/**`, `src/components/food/**` (yours from round 1)

## What to build

### 1. Club dashboard: `/host`

- `listMyHostedEvents()`: split into Upcoming, Happening now and Past.
- Each row: title, time, place, `rsvpCount` going, `checkedInCount` checked in, and buttons for Check in, Manage and View page (`/events/[id]`, built by the Student thread).
- Totals at the top: events hosted, total check-ins, average turnout rate (checked in divided by going).
- Empty state: "You have not posted an event yet" with a button to `/post`.

### 2. Manage an event: `/host/[id]`

- Load with `getEvent(id)`. If the signed-in user did not create it, say so plainly and show nothing else.
- Guest list from `listGuests(id)`: name, a "Verified SFSU" badge when `sfsuVerified`, registered time, and checked-in status. Search by name. Filter: all, checked in, not yet.
- Live counts. Refresh the list when counts change.
- Edit: reuse the event form from `/post` with the event's values, save with `updateEvent`. Run the same `check-event` call before saving.
- Cancel event: `deleteEvent`, behind a confirm dialog that says how many people registered.
- For a finished event with `hasFood`: a gold "Post leftover food" button that opens `/post?tab=food` with this event's building and room prefilled.
- "AI recap" area: the main thread is building `POST /api/ai/event-recap`. Until it exists, stub it: request `{ eventId }`, response `{ recap: string }`. Show it labeled as AI-written, only for finished events.

### 3. Door check-in: `/host/[id]/check-in`

Luma's check-in screen: camera on top, a live "checked in / going" bar below. Reference: https://mobbin.com/screens/fc3826ca-0719-4e8f-a59e-c7c0c798641a

- Scan with `@yudiel/react-qr-scanner`. The QR code contains the ticket `code`. Call `checkIn(code)`.
- Big, instant feedback for every result: success with the guest's name, `already_checked_in` with the earlier time, `not_found`, `not_host`.
- Do not re-submit the same code while it stays in frame.
- A text box to type the 8-character code by hand, for when the camera is denied or fails. This path must work with no camera at all.
- Ask for the camera only when the host presses Start scanning, and explain a denied permission in plain words.
- Built for a phone held at a door: large targets, works at 390px.

### 4. Restructure `/post`

Luma's create-event layout, reference: https://mobbin.com/screens/e91e76f1-5a82-4a96-9b09-203c74707676

- First step: "What are you sharing?" with two large choices, An event and Leftover food. Keep `?tab=food` and `?tab=event` working.
- Event form: flyer or cover on the left, fields on the right, start and end as one grouped date and time block, location as its own block. Keep all current behavior: AI draft, the exact code checks, warnings versus errors.
- After publishing an event: links to the event page, to Manage, and to Check in.
- Keep the food form's behavior as is, including "Limit per student".

## Subagents (1 to 5)

| Agent | Files | Job |
|---|---|---|
| 1 | `src/app/host/page.tsx`, `src/components/host/dashboard*.tsx` | Dashboard and totals |
| 2 | `src/app/host/[id]/page.tsx`, `src/components/host/guest-list.tsx`, `manage*.tsx` | Manage page, guest list, edit, cancel |
| 3 | `src/app/host/[id]/check-in/**`, `src/components/host/scanner.tsx` | Scanner and manual code entry |
| 4 | `src/app/post/**`, `src/components/post/**` | Post restructure |

Agents 2 and 4 both touch the event form (edit reuses it). Decide in your plan how the form takes initial values and a save handler before spawning.

## Requests file

`docs/plans/requests-host.md`

## Test before done

Post an event, open `/host`, open Manage. In a second browser window (a different anonymous user), register for it through the database function or the Student thread's page if it is merged. Check that guest in by typing the code, then try the same code again. Edit the event and confirm a wrong weekday still blocks saving. Cancel a test event. Check the check-in page at 390px wide.
