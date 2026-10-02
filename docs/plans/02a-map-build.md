# Thread A build plan: student map

## Layout

- Desktop: left column (header, search, filter chips, list), map on the right. The detail panel floats over the left edge of the map, so the list stays visible and in sync.
- Phone: map on top, list below. The detail panel covers the list area.

## Shared state (lives in `src/app/map/page.tsx`)

```ts
type Selection =
  | { kind: "event"; id: string }
  | { kind: "rescue"; id: string }
  | { kind: "building"; id: string } // a pin with several events
  | null;
```

| Prop | Meaning |
|---|---|
| `selection` / `onSelect(selection)` | One selection for list, map and detail |
| `hoveredBuildingId` / `onHoverBuilding(id)` | Hovering a list item highlights its pin, and the reverse |
| `events`, `rescues` | Already filtered by `useEventFilters` |
| `freshIds` | Ids that arrived live after the first load, shown as "New" with a pulsing pin |

Pin click: one item at the building selects that item, several select the building and the detail panel lists them.

## Files

| File | Job | Built by |
|---|---|---|
| `scripts/seed.mjs` | Check every building coordinate against OpenStreetMap, add 4 events, run `npm run seed` | Subagent 1 (background) |
| `src/components/map/map-utils.ts` | `Selection` type, time formatting, group by building | Main |
| `src/components/map/use-event-filters.ts` | Filter state and logic: Now, Today, This week, Free food, tags, search | Main |
| `src/components/map/use-fresh-ids.ts` | Tracks ids that appear after first load | Main |
| `src/components/map/filters.tsx` | Search box and chips | Main |
| `src/components/map/building-pin.tsx` | Purple count pin and gold food pin | Main |
| `src/components/map/campus-map.tsx` | One pin per building, selection, fly-to, highlight | Main |
| `src/components/map/event-list.tsx` | List, skeleton, empty and error states | Main |
| `src/components/map/event-detail.tsx` | Event, rescue and building detail | Main |
| `src/app/map/page.tsx` | Wiring, header count, toast for live arrivals | Main |

Only the seed work goes to a subagent: it is independent research on a separate file. The UI pieces share one selection model and are small, so one author keeps them consistent and faster to fit together.

## Order

1. Spawn the seed subagent.
2. Utils and hooks, then pins and map, then list, detail and filters, then the page.
3. `npx tsc --noEmit`, `npx eslint src scripts`.
4. Browser check at 1440px and 390px on port 3601, including a live insert.
5. `web-design-guidelines` pass, fix findings, commit to `thread/map`.
