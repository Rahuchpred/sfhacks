# Add-on: help board and official safety notices

Two additions on top of round 3. The database, data functions and AI routes are built and tested on `main`. Three agents build the pages, each in its own worktree, started and merged by the main thread.

## Help board

Faculty and staff ask for one-time help in plain words. Students offer to help. Finished help lands on the student's profile, the same way a check-in does.

- Every request must say what the student gets back (`rewardType`: course credit, reference letter, experience, volunteer hours or paid). This is required by the database, so the board cannot become a source of free labor with nothing in return.
- Requests are short, one-time asks.
- AI: `POST /api/ai/structure-help` `{ text }` turns the requester's words into a title, description, time needed, skills, reward and building. It returns `rewardType: null` when the text does not say what the student gets, and the form must then ask.
- Data functions in `src/lib/db.ts`: `listOpenHelpRequests`, `getHelpRequest`, `listMyHelpRequests`, `createHelpRequest`, `setHelpRequestStatus`, `offerHelp`, `withdrawHelpOffer`, `listMyHelpOffers`, `listHelpOffers` (requester only), `setHelpOfferStatus` (requester only).

| Route | What | Agent |
|---|---|---|
| `/help` | Browse open requests, filter by reward and skill | help-student |
| `/help/[id]` | Request detail, offer to help with a short note | help-student |
| `src/components/help/my-help.tsx` | "Help I gave" list for the profile page | help-student |
| `/help/new` | Describe the need, AI structures it once automatically, edit, publish | help-requester |
| `/help/mine` | My requests, the offers on each, accept, decline, mark done | help-requester |

## Safety notices

Official University Police notices only. Nobody can post one from the app.

- Source: https://upd.sfsu.edu/timely-warnings-0. `POST /api/safety/refresh` reads the page, and the AI turns each warning into a neutral notice.
- The summary never describes a person: no clothing, appearance, race, age or gender, and nothing about the victim.
- Sensitive notices (sexual assault, stalking, dating violence, anything in a residence hall) have `showPin: false`. They are listed, never pinned to a place.
- Every notice shows its date, says it comes from University Police, and links to the source.
- The page states plainly that this is for awareness, not an emergency system: call University Police at (415) 338-7200, or 911.
- Data: `listSafetyNotices()`.

| Route or file | What | Agent |
|---|---|---|
| `/safety` | The notices list, the emergency numbers, support resources | safety |
| `src/components/safety/safety-markers.tsx` | Map markers for notices with `showPin`, ready to drop into the campus map | safety |

The main thread adds the markers to the map and "Help I gave" to the profile when it merges.
