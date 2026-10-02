# Demo script: 2 minutes, everything, with what each part uses

Setup: restart the dev server. Sign in with the code 000000 in three tabs:
- localhost:3600 = owner@demo.gatorradar.test (club owner)
- 127.0.0.1:3600 = member@demo.gatorradar.test (club member)
- gator.localhost:3600 = student@demo.gatorradar.test (student, no club)
Try the mic once before judges arrive (the speech model downloads on first use). Flyer on the desktop.

0:00 The problem, the map (student tab, /map)
"SpaceX asked me to host a build night at SF State and I could not find a club, a room or the rules. So I built Gator Radar."
Show: pins with "Now" and times, 3D buildings, the glow on live and food buildings.
[MapLibre + mapcn map, OpenFreeMap tiles, 3D building extrusion, live updates via Supabase Realtime]

0:15 AI 1: speak an event, get a room (owner tab, /post)
Mic: "Design club Figma workshop next week in the afternoon, about 30 people, with snacks, one hour." Fix one word. Press Plan it.
"Speech becomes text on my laptop. Gemma 4 understands the idea. The rooms come from the real class schedule, so the AI cannot invent a room."
[Whisper speech to text running in the browser (transformers.js) + Gemma 4 (gemma-4-31b-it via the Gemini API) for the idea and the reasons + plain code over the real SFSU Fall 2026 schedule: 3,741 sections, 327 rooms, for free rooms, class clashes and the turnout forecast]
Press Use this: the form fills in.

0:50 AI 2: flyer to event (owner tab)
Drop the poster. The form fills itself.
[Gemma 4 reads the image and returns JSON + zod validation + code checks for dates, buildings and tags]

1:05 Three roles, one app (all three tabs)
Student: map, free food, tickets, messages. Member: door check-in and leftover food, Analytics says "Organizers only". Owner: everything.
[Supabase Postgres row level security: a member gets 0 attendance rows from the database, the owner gets them all]

1:20 Messaging (student tab, event page)
"Ask the host" on Open Lab, the club answers live, the student sees the club name, never a member's name.
[Supabase Realtime + security definer functions + a rate limit, no AI]

1:30 AI 3: organizer data (owner tab, /host/analytics)
Charts by major and AI insights. Reports copy into Google Sheets for the school.
[Gemma 4 writes the insights from numbers that code computed from real check-ins + Recharts + CSV / tab-separated export]

1:45 Campus safety and close (switch a demo account to Safety, /safety/alerts)
Post an alert. The red circle with the time appears live on the student's map. All clear.
[Supabase Realtime broadcast + row level security: only the safety role can post, no AI touches the text]
"Faculty get event attendance and a help board with students. Next: a pilot with one club and one department."

If something fails: skip it and keep talking.
Responsible AI, one line each: speech stays on the device; code decides facts, not AI; recruiters only see opted-in students; everything works without AI.
Say once: the class schedule and police notices are real, the events and students are sample data.
