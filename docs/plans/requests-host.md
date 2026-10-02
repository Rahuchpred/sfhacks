# Requests from the Host thread to the main thread

## 1. `POST /api/ai/event-recap`

**Why:** the manage page shows an AI recap for finished events.

**Shape the host thread built against:** request `{ eventId: string }`, response `{ recap: string }`, failure `{ error }` with status 400 or 500.

**Stub in use meanwhile:** `src/components/host/recap.tsx` calls the route. On a 404 it shows a recap written in code from the event's own counts, labeled as a placeholder, not as AI. Nothing else needs to change when the route lands.

## 2. A "Host" link in the top nav

**Why:** `/host` is not reachable from `src/components/app-shell.tsx`, which is frozen.

**Wanted:** add `{ href: "/host", label: "Host" }` to `NAV`.

**Meanwhile:** `/post` and the post-publish screen link to `/host`.

## 3. Realtime on `rsvps` for the event's host (nice to have)

**Why:** the guest list refreshes when the event's counters change, which works today because `events` is in the realtime publication. It does not refresh on a change that leaves the counters alone, for example a guest renaming their profile. Low priority.
