# Contracts

The single source of truth for data shapes. Frozen: change these only in the main thread, never inside a feature thread.

## Files

| File | What it holds |
|---|---|
| `src/lib/types.ts` | App types (camelCase) and AI route request/response types |
| `src/lib/db.ts` | The only code that reads or writes Supabase. Use these functions, do not query tables directly |
| `src/lib/database.types.ts` | Generated from the database. Regenerate with `supabase gen types typescript --linked` |
| `src/lib/ai.ts` | `generateJson()`, the only way to call the model |
| `src/lib/ai-schemas.ts` | zod schemas that validate model output |
| `src/lib/checks.ts` | Exact event checks in code, plus `EVENT_TAGS` (the fixed tag list) |
| `supabase/migrations` | Database schema. New changes go in a new migration file |

## Data access (`src/lib/db.ts`)

- `listBuildings()`, `listUpcomingEvents()`, `listOpenRescues()`
- `createEvent(event)`, `createRescue(rescue)`
- `claimPortion(rescueId)`: atomic, takes one portion, returns `{ ok, portionsLeft, reason }`. A student can call it until they hold `rescue.maxPerPerson` portions, then it returns `already_claimed`
- `listMyClaims()`: rescue ids the signed-in user has claimed. An id repeats once per portion held
- `FoodRescue.maxPerPerson` (1 to 10): set by the poster in the food form, default 1
- `uploadImage(file)`: returns a public URL

Round 2 additions:

- Events: `getEvent(id)`, `listMyHostedEvents()`, `updateEvent(id, changes)`, `deleteEvent(id)`. `CampusEvent.rsvpCount` and `checkedInCount` are live counters
- Tickets: `rsvpEvent(eventId)` (safe to call twice, returns the same ticket), `cancelRsvp(eventId)`, `getMyTicket(eventId)`, `listMyTickets()`. `Ticket.code` is 8 characters and is what the QR code encodes
- Door: `checkIn(code)` returns `{ ok, reason, guestName, eventId, checkedInAt }`, reasons `not_found`, `not_host`, `already_checked_in`. `listGuests(eventId)`. Both work only for the user who created the event
- Profiles: `getMyProfile()` (null until first save), `saveMyProfile(changes)`, `listRecruiterVisibleProfiles()`. `email` and `sfsuVerified` are set by the database from the signed-in account and cannot be written by the client. `recruiterVisible` is the student's opt-in, off by default, enforced by row level security
- Libraries: `qrcode.react` to draw a QR code, `@yudiel/react-qr-scanner` to scan one
- `useCampus()` in `src/lib/use-campus.ts`: live buildings, events and rescues for any client component

## AI routes

All routes are `POST`, take JSON and return JSON. On failure they return `{ error }` with status 400 or 500.

| Route | Request | Response |
|---|---|---|
| `/api/ai/extract-event` | `ExtractEventRequest` `{ text?, imageUrl? }` | `ExtractEventResponse` `{ event, missing, confidence }` |
| `/api/ai/check-event` | `CheckEventRequest` `{ event }` | `CheckEventResponse` `{ ok, issues, questions }` |
| `/api/ai/estimate-food` | `EstimateFoodRequest` `{ imageUrl, postedAt }` | `EstimateFoodResponse` `{ items, portions, dietary, safeUntil, note }` |
| `GET /api/ai/ping` | none | `{ mock, model, reply, gemmaModels }` |

How the AI and code split the work:

- **Check event:** dates, weekday, past events, end before start and missing fields are checked in code (`src/lib/checks.ts`). Only those can be `severity: "error"` and block publishing. Model findings are always `"warn"`. A missing room is a warning, not an error.
- **Extract event:** building ids and tags from the model are dropped unless they exist in the building list and in `EVENT_TAGS`. `missing` is computed in code.
- **Estimate food:** `safeUntil` is computed in code: 2 hours after posting for perishable food, 8 hours for sealed packaged food.

Round 2 routes need the signed-in user. Call them with `postJson(path, body)` from `src/lib/api.ts`, which attaches the session token. They return 401 without it.

| Route | Request | Response |
|---|---|---|
| `/api/ai/profile-summary` | `{}` | `{ summary, reason }`. `summary` is null with `reason: "no_checkins"` when the student has no check-ins yet |
| `/api/ai/event-recap` | `{ eventId }` | `{ recap, stats }`. Host only (403 otherwise). `stats` are counted in code |
| `/api/ai/recruiter-search` | `{ query }` | `{ matches: [{ profileId, reason, evidenceEventIds }] }`. Only opted-in students |

These calls take 10 to 25 seconds. Always show a loading state.

`imageUrl` must be a URL returned by `uploadImage()`. With `AI_MOCK=1` or no `GEMINI_API_KEY`, routes return the fixtures in `src/lib/fixtures`.

## Design rules

- Purple (`bg-primary`) means events. Gold (`bg-accent`) means food.
- Gold never carries white text. Use `text-accent-foreground`.
- Desktop website first: top nav, full-width pages. Layouts must still stack cleanly on a phone.
- Components come from `src/components/ui` (shadcn). Add new ones with `npx shadcn@latest add <name>`.

## Round 3 additions

See `docs/plans/20-round3-overview.md` for the full list of new data functions (clubs, pickup codes, event-linked food, analytics rows) and the current ownership split.

- `createRescue` needs `eventId` set to an event the user manages. The database rejects anything else
- `claimPortion` returns `claimCode` and `expiresAt`. A hold lasts 15 minutes unless `confirmPickup` is called by the poster
- `listMyClaims()` now returns `MyClaim[]`, not ids
- `checkEventDraft()` in `src/lib/checks.ts` is safe to run in the browser for instant validation

## Folder ownership

See `docs/plans/20-round3-overview.md`.
