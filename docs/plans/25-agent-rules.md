# Rules for every build agent

You are one of several agents building Gator Radar in parallel, each in its own git worktree. The main thread started you, and it will review and merge your branch. Your final report is the only thing it sees.

## Setup

1. Your worktree has no dependencies. Run `npm install`.
2. Link the env file: `ln -s /Users/rahazh/Documents/coding/sfhacks-new/.env.local .env.local`
3. Use the dev port given in your brief. Never use 3000, 3600, 3601 or 3602. Stop your server when you finish.

## Read before coding

- `docs/plans/20-round3-overview.md`: the product, the user's complaints (a "do not repeat" list), the decisions, and what already exists in `src/lib/db.ts`
- The section of `docs/plans/21-thread-student.md` or `22-thread-host.md` named in your brief
- `src/lib/types.ts`, `src/lib/db.ts`, `src/lib/contracts.md`
- `AGENTS.md`: this Next.js version has breaking changes. Check `node_modules/next/dist/docs/` before using an API you are unsure of. Dynamic pages take `PageProps<"/route/[id]">` and `params` is a Promise. Run `npx next typegen` after adding a route.

## Ownership

- Edit only the files your brief lists. Other agents are editing the rest right now.
- Never edit: `src/lib/**`, `supabase/**`, `src/components/ui/**`, `src/components/app-shell.tsx`, `src/components/auth-provider.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/api/**`, `package.json`, `docs/plans/**`.
- Other folders import from yours. Keep every existing export working with the same name and meaning. In particular: `src/components/map/map-utils.ts`, `useNow` in `src/components/map/use-event-filters.ts`, `src/components/food/countdown.tsx`, `src/components/post/field.tsx`, `src/components/post/image-drop.tsx`, the `EventForm` export in `src/components/post/event-form.tsx`, and `src/components/tickets/ticket-qr.tsx`.
- You may read and import from any folder.
- Need something that does not exist (a data function, a shadcn component, a change in someone else's file)? Do not make it. Work around it, and list it in your report.

## Design

- Before designing each screen, call the Mobbin tool `mcp__mobbin__search_screens` with platform `web` (load it with ToolSearch if needed) and name the reference in a comment at the top of the component. If the tool is unavailable, say so in your report and continue.
- shadcn components from `src/components/ui`. Geist font. Purple (`bg-primary`) for events, gold (`bg-accent` with `text-accent-foreground`) for food.
- A desktop website first. It must also work at 390px wide.
- Very little text. Labels over sentences.
- A field marked optional never shows a "needs input" marker or a warning.
- No browser-default date, time or number pickers. Dates use the shadcn `calendar` in a `popover`. Times, years and fixed choices use `select` or chips.
- AI never runs on a button the user must find, and never re-runs in a loop. Validation is instant code.
- Every button shows a pending state. Every list has loading, empty and error states.
- Motion is fast and purposeful, and respects reduced motion. When your feature works, run the `emil-design-eng` and `review-animations` skills on your files and apply what they recommend.

## Writing

- Never use em dashes or en dashes anywhere, in code, comments or UI text. Use commas, colons or hyphens.
- Match the code style, naming and comment density of the surrounding files.

## Finish

- `npx tsc --noEmit` and `npx eslint src` pass.
- Open your pages in a browser at 1440px and 390px wide if you can, and click through your feature. Delete any test rows you create in the database.
- Commit on your worktree's current branch. Do not push, do not switch branches. End the commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Final report: the branch name and commit hash, the files you created or changed, what you verified by running it versus what you did not test, the Mobbin references you used, and anything you needed that was missing.
