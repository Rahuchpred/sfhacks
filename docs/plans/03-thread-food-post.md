# Thread C: Food rescue and organizer posting

You are one of three parallel threads building Gator Radar, a live map of events and free food at SF State. This file is your full brief. Plan first, then build.

## Where you work

| | |
|---|---|
| Folder (git worktree) | `/Users/rahazh/Documents/coding/sfhacks-food` |
| Branch | `thread/food` |
| Dev server | `npx next dev -p 3602` (never use 3000 or 3600) |
| Main thread's folder | `/Users/rahazh/Documents/coding/sfhacks-new` (branch `main`, do not edit files there) |

The worktree is already created with dependencies installed and `.env.local` linked. Stay in your folder and on your branch. Do not create other branches.

## Read first

1. `src/lib/contracts.md`: data functions, AI route shapes, design rules, folder ownership
2. `docs/plans/gator-radar.md`, section 4.5 (organizer tools)
3. `docs/reference/hackathon-rules.md`: judging criteria. "All features presented are working" is scored
4. `AGENTS.md`: this Next.js version has breaking changes, check `node_modules/next/dist/docs/` before using an API you are unsure of
5. `src/lib/db.ts`, `src/lib/types.ts`, `src/lib/fixtures/index.ts`

## Step 1: write your plan

Before any code, write `docs/plans/03a-food-post-build.md`: the components you will create, which subagent builds which files, and the order. Keep it short. Then execute it without waiting for approval.

## What you own

- `src/app/food/**`
- `src/app/post/**`
- `src/components/food/**`
- `src/components/post/**`

## Do not touch

`src/lib/types.ts`, `src/lib/db.ts`, `src/lib/ai.ts`, `src/lib/prompts/**`, `supabase/migrations`, `src/components/ui/**`, `src/components/app-shell.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/api/**`, `src/app/map/**`, `src/components/map/**`.

If you need a change in a frozen file (a new db function, a new type, a new shadcn component), do not make it. Write the request in `docs/plans/requests-food.md`, tell the user, and build against a local stub meanwhile.

## The AI routes you call

The main thread is making these real. Until then they may return the same mock answer every time. Build against the documented shapes, they will not change.

| Route | Send | Get |
|---|---|---|
| `POST /api/ai/extract-event` | `{ text?, imageUrl? }` | `{ event, missing, confidence }` |
| `POST /api/ai/check-event` | `{ event }` | `{ ok, issues, questions }` |
| `POST /api/ai/estimate-food` | `{ imageUrl, postedAt }` | `{ items, portions, dietary, safeUntil, note }` |

Any route can fail with `{ error }` and status 400 or 500. Images must be uploaded first with `uploadImage(file)` from `src/lib/db.ts`, which returns the `imageUrl`. A real model call can take several seconds, so every call needs a visible loading state.

## What to build

A desktop website. Forms sit in a comfortable centered column and stack cleanly on a phone.

### `/post`: two flows, chosen with tabs

**Flow 1: post an event (organizer)**

1. Start from anything: drop or pick a flyer image, or paste rough text.
2. Call `extract-event`. Prefill an editable form: title, club, building (select from `listBuildings()`), room, start, end, description, tags, has food.
3. Fields the AI could not find (`missing`) are visibly marked as needing input.
4. Call `check-event` on the form values before publishing. Show `issues` next to the matching field: errors block publishing, warnings do not. Show `questions` as prompts.
5. The organizer fixes the fields, the check reruns, and Publish becomes available.
6. Publish with `createEvent()`. Confirm with a toast and a link to `/map`.

**Flow 2: post leftover food**

1. Drop or pick a photo of the food.
2. Call `estimate-food` with the upload URL and the current time.
3. Show an editable result: items, portions, dietary tags, safe-until time, plus building and room.
4. Label it clearly as an AI estimate the poster must confirm. The poster can change every value.
5. Publish with `createRescue()`. Confirm with a toast and a link to `/food`.

### `/food`: claim free food

1. A grid of open rescues from `useCampus()`: photo, items, building and room, portions left, dietary badges, and a "safe until" time that counts down.
2. A Claim button calls `claimPortion(id)`. Handle every `reason`: `already_claimed`, `gone`, `expired`, `not_signed_in`, `not_found`.
3. After claiming, the card shows the claim as held and where to pick it up.
4. Live: portions left updates for everyone without a refresh. A rescue that hits zero or passes its safe-until time leaves the open list.
5. States: loading skeleton, friendly empty state, error state.

### Responsible AI, visible in the UI

- AI output is always editable and labeled as an estimate before anything is published.
- A short allergen notice on every rescue: dietary tags are estimates, ask the organizer if you have an allergy.
- Nothing is published without the organizer pressing Publish.

Colors: gold (`bg-accent` with `text-accent-foreground`) for food, purple (`bg-primary`) for events. Use shadcn components from `src/components/ui`.

## Subagents (1 to 5)

Spawn only for pieces that touch different files. A suggested split:

| Agent | Files | Job |
|---|---|---|
| 1 | `src/components/post/image-drop.tsx` | Shared image picker: drag and drop, preview, upload with `uploadImage()` |
| 2 | `src/components/post/event-form.tsx`, `issue-list.tsx` | Event flow: extract, editable form, check, publish |
| 3 | `src/components/post/food-form.tsx` | Leftover food flow: estimate, edit, publish |
| 4 | `src/components/food/rescue-card.tsx`, `rescue-grid.tsx`, `countdown.tsx` | Food list, claim button, live states |

Agent 1's component is used by agents 2 and 3, so fix its props in your plan before spawning. You wire the pages in `src/app/post/page.tsx` and `src/app/food/page.tsx` yourself.

## Verify before you say done

- `npx tsc --noEmit` and `npx eslint src` pass
- In a browser at `http://localhost:3602`, at 1440px and 390px wide: publish an event from pasted text, publish one from an image, post a food rescue, claim it, and confirm the count drops
- Open `/food` in two browser windows and confirm a claim in one updates the other
- Run the `web-design-guidelines` skill on your files and fix what it finds
- Delete the test rows you created when you finish
- No em dashes or en dashes anywhere, in code, comments or UI text

## Commit and hand off

- Commit to `thread/food` at each working checkpoint. Do not push, do not open a PR.
- To pick up changes from main: `git merge main`
- When a feature is ready, tell the user "thread/food is ready to merge" with a one-line summary. The main thread merges it into `main`.
- End commit messages with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
