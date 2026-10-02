# Round 3, Main thread

Folder `/Users/rahazh/Documents/coding/sfhacks-new`, branch `main`, port 3600. See `20-round3-overview.md`.

## Done already

- Database: clubs, members, join codes, club permissions on events, check-in and guest lists. Food posts tied to a managed event. Claims as 15-minute holds with pickup codes, release of expired holds, pickup confirmation. Attendance rows for analytics. Event `foodItems` and `cost`. All tested against the live database.
- `src/lib/types.ts`, `src/lib/db.ts`, `FOOD_OPTIONS`, and the new shadcn components.

## To do

1. **Sidebar shell.** Replace the top bar with the shadcn sidebar: large icon and label rows, grouped as For students (Map, Free food, Clubs, Tickets, Profile), For clubs (Host, Post, Analytics), and Recruiters. Collapses to icons, becomes a drawer on a phone. Mobbin reference first.
2. **Check route becomes instant.** `check-event` returns the code checks only, with no model call. Add `foodItems` to the extract result.
3. **Analytics page: `/host/analytics`.** Data first, from `listHostAttendance()` and the hosted events:
   - Totals: events, registrations, check-ins, turnout rate, unique students, cost per attendee
   - Turnout by event (registered versus checked in)
   - Attendees by major and by graduation year
   - New versus returning students
   - Arrival pattern (check-in times relative to the event start)
   - Turnout by weekday and time of day, with food versus without
   - The people table: name, major, year, events attended, verified
   - Filter by club and by event
4. **AI insights on top of the data.** `POST /api/ai/host-insights`. Numbers are aggregated in code and passed in. The model returns 3 to 5 findings, each pointing at the numbers behind it, plus one suggestion for the next event. It never sees names.
5. **School report export.** A CSV download (opens in Google Sheets) with three sheets' worth of data: events with cost and turnout, attendance per event, and people. A live Google Sheets sync needs Google sign-in, so it is listed as a pilot step.
6. **Merge both threads, full click-through, then the animation pass on shared pieces.**
