# Round 3, Student thread

Read `docs/plans/20-round3-overview.md` first.

Folder `/Users/rahazh/Documents/coding/sfhacks-map`, branch `thread/map`, dev server `npx next dev -p 3601`. Start with `git merge main` and `npm install`. Write your plan to `docs/plans/21a-student-build.md`, then build. Requests go in `docs/plans/requests-student.md`.

## You own

`src/app/page.tsx`, `src/components/landing/**`, `src/app/map/**`, `src/components/map/**`, `src/app/food/**`, `src/components/food/**` (moved to you this round), `src/app/clubs/**`, `src/components/clubs/**`, `src/app/events/**`, `src/components/events/**`, `src/app/tickets/**`, `src/components/tickets/**`, `src/app/profile/**`, `src/components/profile/**`.

## 1. Landing page: rebuild from scratch

The current one copied another site and the user called it awful. Delete it and start over.

- Reference: cursor.com. Open it in the browser and study the structure: a calm hero with one headline, one line under it and one button, then a small set of feature blocks, then a footer. Also look at the feature grid on obsidian.md (four cards, each a title, two lines of text and a small visual).
- Borrow the structure and restraint, not their code, images or wording.
- **Three sections at most:** hero, features, footer.
- **Hero:** no screenshot and no fake product image. Headline, one short line, one primary button to `/map`, one quiet link for clubs to `/post`.
- **Features:** four cards at most (the map, free food, QR check-in, the profile that builds itself). Each card is a title, one short line and a small visual made from real UI pieces or simple shapes.
- **No** "trusted by", logo walls, testimonials, pricing or invented statistics. One true line is fine, for example the live count of upcoming events.
- **Footer:** an SFSU footer with the purple hover effect from the user's other project. Read `/Users/rahazh/Documents/coding/t3/app/footer.tsx` and `/Users/rahazh/Documents/coding/t3/app/t3.css` and rebuild that hover effect in SFSU purple. Keep the footer short.
- Very little text. If a sentence can go, it goes.
- The page must sit well inside the new sidebar shell from the main thread. Ask in your requests file if the landing page should hide the sidebar.

## 2. Map: make pins readable

The user could not match a pin showing "1" to anything in the list.

- A pin shows what is there, not just a count: an icon or color for the main category, and the event title on hover. A building with several events shows the count plus a popover listing their titles.
- Food is unmistakable: a gold pin with a food icon.
- Hovering a list row highlights its pin clearly, and the reverse. Selecting either selects both and scrolls the list to the row.
- More filters: by club (`listClubs()`), by building, has free food, starting soon, registered by me. Show active filters as removable chips with a Clear all.
- A small legend for the pin colors and icons.

## 3. Free food: claim with a pickup code

- On load, call `releaseExpiredClaims()`, then show open rescues.
- Claim calls `claimPortion(id)`. On success show the 4-character `claimCode` large, the pickup place and a countdown to `expiresAt` (15 minutes). Wording: show this code to the organizer.
- "Your pickups" comes from `listMyClaims()`, not from browser storage: holding (with code and countdown), picked up, and expired. Delete the old localStorage claim store.
- Each card names the event the food comes from and links to it.
- When a hold expires, say so plainly and let the student claim again if portions remain.
- Keep the per-student limit and the allergen notice.

## 4. Clubs directory: `/clubs` and `/clubs/[id]`

- `/clubs`: a searchable grid of clubs from `listClubs()`. Each card shows the club name, how many upcoming events, and the next event.
- `/clubs/[id]`: the club name, upcoming events, past events, and totals from the public counters (`rsvpCount`, `checkedInCount`).
- Event pages and map rows link to the club when `event.clubId` is set.
- A list, not a second map: the map already exists. Add the club filter there instead.

## 5. Event page and profile fixes

- Event page: show `foodItems` as chips when the event has food. Link to the club.
- Profile: graduation year is a `select` (this year to six years out), not a number box. Major is a searchable select of common SFSU majors with an "Other" option.
- The saved AI summary says "edited by you" even when it was not edited. Only say it when the text was changed.

## 6. Animation pass

After everything works, run `emil-design-eng`, `animate` and `review-animations` over your files and apply the results.

## Suggested subagents

| Agent | Files |
|---|---|
| 1 | Landing page and footer |
| 2 | Map pins, legend, filters |
| 3 | Food page and claim flow |
| 4 | Clubs directory and club page |
| 5 | Event page, profile fixes |
