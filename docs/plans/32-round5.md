# Round 5: role coordination, food management, safety alerts, livelier events

Read `docs/plans/25-agent-rules.md` first. The ownership table there is replaced by the one below.

## Decisions from the user

- Club levels: **owner** (everything), **organizer** (post events, see data), **member** (helps at events: check in guests at the door and post leftover food, but no analytics, no reports, no guest list export). A person who joins with the invite code starts as a member. The owner changes levels in My clubs.
- It must be obvious which view you are in: a normal student, a club member, a club owner.
- Food: a club can find where to post food easily, mark a post "Food is gone", or remove it. When a post is removed or closed while a student holds a portion, the hold is cancelled and the student sees that the food is no longer available.
- Safety: a new role `safety` ("Campus safety") already exists in the database, in `Role`, in `src/lib/roles.ts` (it may open `/safety/alerts`) and in the demo role switch. A safety officer pins an alert on the map. Everyone sees it on the main map as a red circle with the time it happened. The officer picks how long it stays (1 hour, 4 hours or 24 hours, default 4), and can clear it early.
- Event rows in the map list all look the same. They should look more alive and different from each other.
- Demo: the one dev server is opened under three names for three separate sign-ins: `localhost:3600`, `127.0.0.1:3600`, `gator.localhost:3600` (`allowedDevOrigins` is set in `next.config.ts`).

## Ownership

| Agent | Port | Owns |
|---|---|---|
| A levels | 3631 | `src/components/app-shell.tsx`, `src/components/auth-provider.tsx`, `src/lib/roles.ts`, the club parts of `src/lib/db.ts` and `src/lib/types.ts`, `src/components/clubs/**`, `src/components/host/club-*.tsx`, `src/app/host/clubs/**`, `src/app/host/analytics/**`, `src/app/host/reports/**`, `src/components/analytics/**`, `src/components/reports/**`, `src/components/host/dashboard*.tsx`, `src/components/host/manage.tsx`, `src/components/host/guest-list.tsx`, `scripts/demo-accounts.mjs`, migration `20261003040000_club_levels.sql` |
| B food | 3632 | `src/components/host/food-*.tsx`, `src/app/host/[id]/food/**`, `src/app/host/food/**` (new), `src/components/food/**`, `src/app/food/**`, `src/lib/db-food.ts` (new), migration `20261003041000_food_manage.sql` |
| C safety | 3633 | `src/components/safety/**`, `src/app/safety/**`, `src/app/map/page.tsx`, `src/lib/db-safety.ts` (new), migration `20261003042000_safety_alerts.sql` |
| D events | 3634 | `src/components/map/**` except what C needs, `src/components/events/**`, `src/app/events/**` |

- Agent A adds the sidebar entries for everyone: "Leftover food" at `/host/food` in "For clubs", and a "Campus safety" group for the `safety` role with "Post an alert" at `/safety/alerts`. B and C do not edit the shell.
- New data functions go in your own `db-*.ts` file. Only A edits `src/lib/db.ts` and `src/lib/types.ts`.
- Push your own migration with `supabase db push --yes` (add `--include-all` if it complains about order). Do not regenerate `src/lib/database.types.ts`; cast in your own files.
- Sign in with your own demo account: `node --env-file=.env.local scripts/demo-admin.mjs zz6-<letter>@sfsu.edu`, then a `.env.development.local` with `DEMO_LOGIN=1` and `DEMO_EMAILS=<that email>`. The code is `000000`. A demo account can switch its role in the sidebar footer, including to "Safety".
- The shared Browser pane is unreliable when several agents run. Use your own tab on your own port, never touch a tab on another port, and fall back to a headless browser from your scratchpad if the pane stops working.
- There is sample data in the database (clubs "Gator Coders" and "SF State Design Collective", 60 students whose emails start with `sample.`). Do not delete or change it. Name your own test rows "ZZ6 <letter> ..." and delete only those.
- The AI key has a per-minute quota. Do not loop AI calls.
