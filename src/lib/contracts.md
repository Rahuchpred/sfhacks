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
| `supabase/migrations` | Database schema. New changes go in a new migration file |

## Data access (`src/lib/db.ts`)

- `listBuildings()`, `listUpcomingEvents()`, `listOpenRescues()`
- `createEvent(event)`, `createRescue(rescue)`
- `claimPortion(rescueId)`: atomic, one per user, returns `{ ok, portionsLeft, reason }`
- `uploadImage(file)`: returns a public URL
- `useCampus()` in `src/lib/use-campus.ts`: live buildings, events and rescues for any client component

## AI routes

All routes are `POST`, take JSON and return JSON. On failure they return `{ error }` with status 400 or 500.

| Route | Request | Response |
|---|---|---|
| `/api/ai/extract-event` | `ExtractEventRequest` `{ text?, imageUrl? }` | `ExtractEventResponse` `{ event, missing, confidence }` |
| `/api/ai/check-event` | `CheckEventRequest` `{ event }` | `CheckEventResponse` `{ ok, issues, questions }` |
| `/api/ai/estimate-food` | `EstimateFoodRequest` `{ imageUrl, postedAt }` | `EstimateFoodResponse` `{ items, portions, dietary, safeUntil, note }` |
| `GET /api/ai/ping` | none | `{ mock, model, reply, gemmaModels }` |

`imageUrl` must be a URL returned by `uploadImage()`. With `AI_MOCK=1` or no `GEMINI_API_KEY`, routes return the fixtures in `src/lib/fixtures`.

## Design rules

- Purple (`bg-primary`) means events. Gold (`bg-accent`) means food.
- Gold never carries white text. Use `text-accent-foreground`.
- Desktop website first: top nav, full-width pages. Layouts must still stack cleanly on a phone.
- Components come from `src/components/ui` (shadcn). Add new ones with `npx shadcn@latest add <name>`.

## Folder ownership

| Folder | Owner |
|---|---|
| `src/app/map`, `src/components/map` | Thread A: student map |
| `src/app/api/ai`, `src/lib/ai.ts`, `src/lib/prompts`, `src/lib/ai-schemas.ts`, `src/lib/fixtures` | Thread B: AI |
| `src/app/food`, `src/app/post`, `src/components/food`, `src/components/post` | Thread C: food rescue and organizer |
| `src/lib/types.ts`, `src/lib/db.ts`, `supabase/migrations`, `src/components/ui`, `src/components/app-shell.tsx`, `globals.css`, `layout.tsx` | Frozen |
