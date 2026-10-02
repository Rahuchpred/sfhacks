# Round 2 build plan: host thread

Branch `thread/food`, worktree `sfhacks-food`, dev server on port 3602.

## Files

| File | What it is | Built by |
|---|---|---|
| `src/components/host/host-utils.ts` | Event phase (upcoming, now, past), time and place labels, turnout rate | Main, first |
| `src/components/host/use-host-event.ts` | Loads one event, checks the signed-in user created it, stays live | Main, first |
| `src/components/host/host-states.tsx` | Shared loading, not found, not your event and error screens | Main, first |
| `src/app/host/page.tsx`, `src/components/host/dashboard.tsx`, `dashboard-row.tsx` | Dashboard: totals, three sections, empty state | Agent 1 |
| `src/app/host/[id]/page.tsx`, `src/components/host/manage.tsx`, `guest-list.tsx`, `cancel-event.tsx`, `recap.tsx` | Manage page: guest list, edit, cancel, leftover food link, AI recap | Agent 2 |
| `src/app/host/[id]/check-in/page.tsx`, `src/components/host/check-in.tsx`, `scanner.tsx` | Door check-in: camera scanner, typed code, live bar | Agent 3 |
| `src/components/post/event-form.tsx` | Luma layout, plus edit mode | Main |
| `src/components/post/post-tabs.tsx`, `src/app/post/page.tsx` | "What are you sharing?" chooser, `?tab=` deep links, food prefill | Main |
| `src/components/post/food-form.tsx` | Accepts a prefilled event, building and room. Behavior unchanged | Main |

## Contracts fixed before spawning

```ts
// host-utils.ts
type EventPhase = "upcoming" | "now" | "past";
eventPhase(event: CampusEvent, now: number): EventPhase
formatEventTime(event: CampusEvent): string        // "Thu, Oct 8, 5:00 PM to 7:00 PM"
formatClock(iso: string): string                   // "5:02 PM"
placeLabel(building: Building | undefined, room: string | null): string
turnoutRate(checkedIn: number, going: number): number | null   // 0 to 100, null when nobody registered

// use-host-event.ts
useHostEvent(id: string): {
  status: "loading" | "ready" | "not_found" | "not_host" | "error";
  event: CampusEvent | null;      // set only when status is "ready"
  error: string | null;
  refresh: () => Promise<void>;
  version: number;                // bumps on every live change, use it to refetch guests
}

// host-states.tsx
<HostGate status error>children</HostGate>   // renders children only when status is "ready"

// event-form.tsx (edit mode, used by the manage page)
type EventFormProps = {
  buildings: Building[];
  initial?: CampusEvent;                    // set = edit mode: no AI draft step, saves with updateEvent
  onSaved?: (event: CampusEvent) => void;   // edit mode: called after a successful save
  onCancel?: () => void;                    // edit mode: shows a Cancel button
};
```

## Decisions

- **Ownership.** `useHostEvent` compares `event.createdBy` with the signed-in user id. Not the creator: one plain sentence, nothing else.
- **Live.** `events` is already in the realtime publication and carries `rsvpCount` and `checkedInCount`, so one `subscribeToCampus` per page drives the counts, and `version` tells the guest list to refetch.
- **Edit.** Same form and same rules as posting. Blocking errors come from `src/lib/checks.ts` run in the browser on every keystroke, so a wrong weekday blocks instantly. The `check-event` route still runs before saving and adds the model's warnings.
- **Check-in.** The camera starts only on a button press. A scanned code is ignored while it is the last code handled and still in frame. The typed-code box is always present and needs no camera.
- **AI recap.** `POST /api/ai/event-recap` does not exist yet. `recap.tsx` calls it and, on a 404, shows a recap written from the event's own numbers, labeled as a placeholder. Requested in `requests-host.md`.
- **Nav.** The frozen app shell has no Host link. Requested. Until then `/post` links to `/host`.
- **Leftover food prefill.** `/post?tab=food&event=<id>&building=<id>&room=<room>`.

## Order

1. Plan, requests file, the three shared host files. Commit.
2. Spawn agents 1, 2 and 3 in parallel. Main restructures `/post` and adds edit mode to the event form.
3. Review, typecheck, lint, commit.
4. Browser pass at 1440px and 390px with two anonymous users: post, dashboard, manage, register, check in by code, repeat the code, edit with a wrong weekday, cancel.
5. `web-design-guidelines` pass, fixes, delete test rows, final commit.
