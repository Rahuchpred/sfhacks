# Gator Radar

One place for campus life at SF State: a live event map, free leftover food, clubs and rooms, tickets and check-in, messages, and data for organizers and faculty. Built at the SF Hacks x GDG AI Hackathon (October 2, 2026) for the **Build For SFSU** track.

Live demo: https://gator-radar-navy.vercel.app

## The problem

Clubs, free rooms and event rules are scattered across SF State, so a student who is invited to bring a big event to campus cannot find out who to ask, which room is free, or what the rules are. Faculty who need help (for example transcribing interviews) have no way to reach students who already know the tools.

## Who benefits

- **Students:** one map of every event and free food, QR tickets, messages with hosts.
- **Club organizers:** say an event idea, get a free room that fits at a time with few class clashes, then see who comes by major.
- **Faculty and staff:** event attendance for class credit, and a help board for one-time help from students.
- **Campus safety:** post an alert that shows as a red circle on everyone's map.
- **Recruiters:** search only students who chose to be visible.

## AI model: Google Gemma 4 through the Gemini API

The project uses **Gemma 4** (`gemma-4-31b-it`, open weights) through the **Gemini API** with the `@google/genai` SDK. The model id is set by the `AI_MODEL` environment variable. Gemma terms: https://ai.google.dev/gemma/terms

Every AI call goes through one function, [`generateJson`](src/lib/ai.ts) (JSON mode, zod validation, one retry), so the integration is in one place. Where Gemma is used:

| Feature | What Gemma does | Code |
|---|---|---|
| Event planner | Understands a spoken or typed idea, then writes a short reason for each room option | [`plan-event`](src/app/api/ai/plan-event/route.ts) |
| Flyer to event | Reads a flyer photo or notes and fills the event form | [`extract-event`](src/app/api/ai/extract-event/route.ts) |
| Leftover food | Reads the food photo or text and picks a category | [`estimate-food`](src/app/api/ai/estimate-food/route.ts) |
| Organizer insights | Explains attendance numbers that code computed | [`host-insights`](src/app/api/ai/host-insights/route.ts) |
| Profile summary | Summarizes the events a student checked in to | [`profile-summary`](src/app/api/ai/profile-summary/route.ts) |
| Recruiter search | Turns a plain sentence into a search over opted-in students | [`recruiter-search`](src/app/api/ai/recruiter-search/route.ts) |
| Safety notices | Rewrites University Police warnings in neutral words | [`safety/refresh`](src/app/api/safety/refresh/route.ts) |

Speech to text is separate: Whisper (`whisper-tiny.en`) runs in the browser, so voice never leaves the device.

**The AI reads and writes text. Code decides facts.** Rooms, times and numbers come from the real SF State Fall 2026 class schedule (3,741 sections, 327 rooms) and real check-ins, in [`planner.ts`](src/lib/planner.ts). The AI cannot invent a room.

## Responsible AI

- **Privacy:** speech stays on the device. Students are hidden from recruiters unless they opt in. Faculty see door check-ins only. Message participants never see each other's emails.
- **Security:** roles and club levels are enforced in the database with row level security, not only in the menus. Only the campus safety role can post alerts, and alerts cannot be edited, only cleared.
- **Bias and accuracy:** the AI never decides a fact. Every AI output is validated, and the forecast says "no past check-ins yet" instead of guessing.
- **Accessibility:** AI never blocks posting, and everything works without it. Motion respects reduced motion.
- **Sensitive content:** safety alert text is never written by AI, and sensitive police notices are shown without a location.

## Real and sample data

Real: the SF State class schedule and room list, and University Police safety notices. **Sample:** the events, students, clubs and check-ins are made-up demo data (`scripts/seed.mjs`, `scripts/seed-demo.mjs`).

## Stack

- Next.js (App Router), Tailwind, shadcn/ui, Geist
- Supabase: Postgres with row level security, Realtime, Storage, Auth
- MapLibre GL with mapcn and OpenFreeMap tiles (OpenStreetMap data), 3D buildings
- Gemma 4 through the Gemini API, Whisper in the browser, Recharts

## Run locally

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run seed                 # buildings and sample events
npm run dev                  # http://localhost:3600
```

With `AI_MOCK=1` or no `GEMINI_API_KEY`, the AI routes return fixtures, so the app runs without a key. Demo script: [`docs/demo`](docs/demo).

## Project docs

- [Product plan](docs/plans/gator-radar.md)
- [Contracts](src/lib/contracts.md)
- [Hackathon rules](docs/reference/hackathon-rules.md)

## License

MIT. See [LICENSE](LICENSE).
