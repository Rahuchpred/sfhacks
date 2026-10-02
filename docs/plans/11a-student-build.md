# Round 2 build plan: student thread

## Shared pieces, agreed before any subagent starts

| Piece | Where | Contract |
|---|---|---|
| `TicketQr` | `src/components/tickets/ticket-qr.tsx` (written by main first) | `<TicketQr code={ticket.code} size={200} className? />`: QR code plus the code in text |
| Time and place text | `src/components/map/map-utils.ts` (exists) | `formatTimeRange(event, now)`, `formatTime(iso)`, `dayLabel(iso, now)`, `placeLabel(building, room)`, `countLabel(n, "event")`, `isHappeningNow(event, now)` |
| Current time | `src/components/map/use-event-filters.ts` (exists) | `useNow()` |
| Switch | `src/components/ui/switch.tsx` | Added with `shadcn add switch`, approved by the user in round 1 |

All pages are client components that load with the functions in `src/lib/db.ts`. Each page has a loading skeleton, an error state and an empty state.

## Who builds what

| Agent | Files | Job |
|---|---|---|
| Main | `ticket-qr.tsx`, `src/components/map/event-detail.tsx`, this plan, requests file | Shared pieces, link the map detail panel to `/events/[id]`, wire up, browser test |
| 1 | `src/app/events/**`, `src/components/events/**` | Event page, registration card that turns into the ticket, name prompt, .ics download, copy link |
| 2 | `src/app/tickets/**`, `src/components/tickets/**` (not `ticket-qr.tsx`) | Tickets page: upcoming then past, checked-in state, empty state |
| 3 | `src/app/profile/**`, `src/components/profile/**` | Profile form, attendance list, stats, AI summary stub, recruiter switch |
| 4 | `src/app/page.tsx`, `src/components/landing/**` | Landing page with live events strip and real counts |

## Order

1. Main: merge, install, `TicketQr`, switch, plan. Done before agents start.
2. Agents 1 to 4 in parallel. Each runs type check and lint on its own files only. No agent starts a dev server or commits.
3. Main: link the map panel, write `requests-student.md` (nav links for Tickets and Profile live in the frozen app shell), then test the whole loop in the browser at 1440px and 390px.
4. `web-design-guidelines` pass, fixes, commit.
