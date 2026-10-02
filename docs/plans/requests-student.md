# Requests from the Student thread

Changes needed in frozen files. The main thread makes them, then the Student thread picks them up with `git merge main`.

## 1. Nav links for Tickets and Profile

**Status:** open, requested 2026-10-02

**File:** `src/components/app-shell.tsx`

**What:** add two links to the top nav, and point the logo at the new landing page.

```ts
const NAV = [
  { href: "/map", label: "Map" },
  { href: "/food", label: "Free food" },
  { href: "/tickets", label: "Tickets" },
  { href: "/profile", label: "Profile" },
  { href: "/post", label: "Post" },
];
```

- The logo link currently goes to `/map`. It should go to `/`, now that `/` is a real landing page.
- At 390px wide five links plus the logo do not fit in one row. Either let the nav scroll sideways (`overflow-x-auto`) or hide the labels behind a menu on small screens.

**Why:** `/tickets` and `/profile` exist but nothing in the shell links to them. Students can only reach them from the event page, the landing page steps and the links inside those pages.

**Until then:** every student page links to the others in its own content, so nothing is blocked.

## 2. `POST /api/ai/profile-summary`

**Status:** open, already planned by the main thread

**Shape the profile page is built against:** request `{}` (the server reads the signed-in user), response `{ summary: string }`, errors `{ error }` with status 400 or 500.

**Until then:** the profile page falls back to a local stub when the route returns 404.

## Done without a request

- `src/components/ui/switch.tsx` was added with `npx shadcn@latest add switch`, approved by the user in round 1 for shadcn components. It is a new file and changes nothing that exists.
