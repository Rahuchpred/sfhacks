# Thread C build plan: food rescue and posting

Branch `thread/food`, worktree `sfhacks-food`, dev server on port 3602.

## Files

| File | What it is | Built by |
|---|---|---|
| `src/components/post/image-drop.tsx` | Drag and drop or pick an image, preview, upload with `uploadImage()` | Main |
| `src/components/post/form-utils.ts` | `Field` wrapper helpers, datetime-local to ISO conversion, tag parsing, `postJson()` for the AI routes | Main |
| `src/components/post/field.tsx` | Label, "Needs input" marker and inline issue messages for one form field | Main |
| `src/components/post/issue-list.tsx` | Issues with no matching field, and the AI's questions | Main |
| `src/components/post/event-form.tsx` | Flow 1: source (flyer or text), extract, editable form, check, publish | Main |
| `src/components/post/food-form.tsx` | Flow 2: photo, estimate, editable result, publish | Main |
| `src/components/post/post-tabs.tsx` | Tabs for the two flows, loads buildings once | Main |
| `src/app/post/page.tsx` | Page header, reads `?tab=food` | Main |
| `src/components/food/countdown.tsx` | `useNow()` clock and the "safe until" countdown | Subagent |
| `src/components/food/use-claims.ts` | Local record of this browser's claims (stub, see below) | Subagent |
| `src/components/food/rescue-card.tsx` | One rescue: photo, items, place, portions left, dietary, claim button, held state | Subagent |
| `src/components/food/rescue-grid.tsx` | Live grid from `useCampus()`, loading, empty and error states, allergen notice | Subagent |
| `src/app/food/page.tsx` | Page header and the grid | Main |

One subagent builds the `/food` side while the main agent builds `/post`. The two sides share no files.

## Shared props, fixed before building

```ts
// image-drop.tsx
type ImageDropProps = {
  label: string;                 // accessible name, also shown in the drop zone
  hint?: string;                 // second line in the drop zone
  value: string | null;          // public URL from uploadImage(), null when empty
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  tone?: "event" | "food";       // purple or gold focus and drag styling
  disabled?: boolean;
};

// both forms
type FormProps = { buildings: Building[] };

// rescue-card.tsx
type RescueCardProps = {
  rescue: FoodRescue;
  building: Building | undefined;
  now: number;                   // ms, from one shared clock in the grid
  held: boolean;                 // this browser already claimed it
  onClaimed: (rescue: FoodRescue) => void;
};
```

## Decisions

- **Check before publish.** Publish stays disabled until `check-event` has run on the current form values and returned no `error` issues. Editing a field marks the check stale and reruns it after a short pause. Local rules (required fields, end after start, start in the future) run instantly alongside the AI check.
- **Missing fields.** Any field named in `missing`, or left null by the AI, shows a "Needs input" marker until it has a value.
- **AI estimates.** Both forms label AI output as an estimate, keep every value editable, and publish only on the Publish button.
- **My claims.** `db.ts` has no way to read the current user's claims, so held claims are kept in `localStorage` (and learned from an `already_claimed` reply). Requested `listMyClaims()` in `docs/plans/requests-food.md`.
- **Leaving the list.** The grid hides a rescue once `portionsLeft` is 0 or `safeUntil` has passed on the shared clock, without waiting for a database change. A held claim stays visible in "Your pickups" until its safe-until time.
- **Images.** Plain `<img>`, since `next/image` would need remote patterns in the frozen config.

## Order

1. This plan and the requests file. Commit.
2. Spawn the `/food` subagent. Meanwhile build `image-drop`, helpers, `event-form`, `food-form`, `/post` page.
3. Review the subagent's work, wire `/food` page. Typecheck and lint. Commit.
4. Browser pass at 1440px and 390px: event from text, event from image, food post, claim, two-window live check.
5. `web-design-guidelines` pass, fixes, delete test rows, final commit.
