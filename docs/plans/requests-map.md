# Requests from Thread A (student map)

Changes needed in frozen files. The main thread makes them, then Thread A picks them up with `git merge main`.

## 1. Add the shadcn Toggle components

**Status:** open, requested 2026-10-02

**What:** add `toggle` and `toggle-group` to `src/components/ui`.

```bash
npx shadcn@latest add toggle toggle-group
```

**Why:** the filter chips on the map (Now, Today, This week, Free food, and the tag chips) are hand-built `<button aria-pressed>` elements in `src/components/map/filters.tsx`. They should be real shadcn components like the rest of the UI.

**What Thread A does after it lands:**

- Replace the local `Chip` in `src/components/map/filters.tsx` with `Toggle`.
- Use `ToggleGroup` for Now, Today and This week, since only one can be on at a time.
- Keep the colors: purple (`bg-primary`) when pressed for event filters, gold (`bg-accent` with `text-accent-foreground`) when pressed for Free food.

**Until then:** the hand-built chips stay. They work and are keyboard accessible, so nothing is blocked.
