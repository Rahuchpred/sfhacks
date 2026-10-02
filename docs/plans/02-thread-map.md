# Thread A: Student map

You are one of three parallel threads building Gator Radar, a live map of events and free food at SF State. This file is your full brief. Plan first, then build.

## Where you work

| | |
|---|---|
| Folder (git worktree) | `/Users/rahazh/Documents/coding/sfhacks-map` |
| Branch | `thread/map` |
| Dev server | `npx next dev -p 3601` (never use 3000 or 3600) |
| Main thread's folder | `/Users/rahazh/Documents/coding/sfhacks-new` (branch `main`, do not edit files there) |

The worktree is already created with dependencies installed and `.env.local` linked. Stay in your folder and on your branch. Do not create other branches.

## Read first

1. `src/lib/contracts.md`: data functions, AI route shapes, design rules, folder ownership
2. `docs/plans/gator-radar.md`: the product
3. `docs/reference/hackathon-rules.md`: judging criteria
4. `AGENTS.md`: this Next.js version has breaking changes, check `node_modules/next/dist/docs/` before using an API you are unsure of
5. The current code you own: `src/app/map/page.tsx`, `src/components/map/campus-map.tsx`, `src/lib/use-campus.ts`

## Step 1: write your plan

Before any code, write `docs/plans/02a-map-build.md`: the components you will create, which subagent builds which files, and the order. Keep it short. Then execute it without waiting for approval.

## What you own

- `src/app/map/**`
- `src/components/map/**`
- `scripts/seed.mjs` (building coordinates and sample events)

## Do not touch

`src/lib/types.ts`, `src/lib/db.ts`, `src/lib/use-campus.ts`, `supabase/migrations`, `src/components/ui/**`, `src/components/app-shell.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/api/**`, `src/app/food/**`, `src/app/post/**`.

If you need a change in a frozen file (a new db function, a new type, a new shadcn component), do not make it. Write the request in `docs/plans/requests-map.md`, tell the user, and build against a local stub meanwhile.

## What to build

This is a desktop website: event list on the left, map on the right. It must still stack cleanly on a phone.

1. **Correct pins.** Building coordinates in `scripts/seed.mjs` were placed from memory. Verify each against OpenStreetMap and fix them, then run `npm run seed`.
2. **Several events at one building.** Pins currently overlap. Show one pin per building with a count, and list that building's events when it is selected.
3. **Event detail.** Clicking a pin or a list item selects the event: the map flies to it, the pin is highlighted, and a detail panel shows title, club, time range, building and room, description, tags, and the flyer image if there is one.
4. **List and map stay in sync.** Hovering a list item highlights its pin. Selecting on either side selects on both.
5. **Filters and search.** Filter chips for Now, Today, This week, Free food, and tags. A search box over title, club and building. The count in the header reflects the filter.
6. **Food rescues on the map.** Gold pins for open rescues, with items, portions left and a "safe until" time. The detail links to `/food`.
7. **Live.** `useCampus()` already reloads on database changes. A newly published event or rescue must appear without a refresh. Make the new pin noticeable.
8. **States.** Loading skeleton, empty state when filters match nothing, error state.

Colors: purple (`bg-primary`) for events, gold (`bg-accent` with `text-accent-foreground`) for food. Use shadcn components from `src/components/ui`.

## Subagents (1 to 5)

Spawn only for pieces that touch different files. A suggested split:

| Agent | Files | Job |
|---|---|---|
| 1 | `scripts/seed.mjs` | Verify and fix building coordinates, add 4 more realistic sample events |
| 2 | `src/components/map/campus-map.tsx`, `building-pin.tsx` | Grouped pins, selection, fly-to, highlight |
| 3 | `src/components/map/event-list.tsx`, `event-detail.tsx` | List, detail panel, states |
| 4 | `src/components/map/filters.tsx`, `use-event-filters.ts` | Filter chips and search logic |

You wire them together in `src/app/map/page.tsx` yourself. Agree the shared props (selected id, hovered id, filtered events) in your plan before spawning, so the pieces fit.

## Verify before you say done

- `npx tsc --noEmit` and `npx eslint src scripts` pass
- Open `http://localhost:3601/map` in a browser at 1440px and at 390px wide and click through every feature
- Run the `web-design-guidelines` skill on your files and fix what it finds
- No em dashes or en dashes anywhere, in code, comments or UI text

## Commit and hand off

- Commit to `thread/map` at each working checkpoint. Do not push, do not open a PR.
- To pick up changes from main: `git merge main`
- When a feature is ready, tell the user "thread/map is ready to merge" with a one-line summary. The main thread merges it into `main`.
- End commit messages with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
