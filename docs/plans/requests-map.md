# Requests from Thread A (student map)

Changes needed in frozen files. The main thread makes them, then Thread A picks them up with `git merge main`.

## 1. Add the shadcn Toggle components

**Status:** done on `thread/map`, 2026-10-02. The user approved running `shadcn add` in this worktree. It adds two new files, `src/components/ui/toggle.tsx` and `toggle-group.tsx`, and changes no existing file, so the merge into `main` is clean.

**What:** add `toggle` and `toggle-group` to `src/components/ui`.

```bash
npx shadcn@latest add toggle toggle-group
```

**Why:** the filter chips on the map (Now, Today, This week, Free food, and the tag chips) are hand-built `<button aria-pressed>` elements in `src/components/map/filters.tsx`. They should be real shadcn components like the rest of the UI.

**Result:** the filter chips in `src/components/map/filters.tsx` now use the shadcn `Toggle`. Purple when pressed for event filters, gold for Free food. `ToggleGroup` is installed but not used yet: the chips sit in one wrapping row, and a nested group would break the wrap.
