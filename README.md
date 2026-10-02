# Gator Radar

A live map of everything happening at SF State: club events, workshops and free leftover food. AI turns messy flyers into map pins, checks organizers' event data before it goes live, and estimates leftover food from a photo so students can claim it before it is thrown away.

Built at the SF Hacks x GDG AI Hackathon (October 2, 2026) for the **Build For SFSU** track.

## Stack

- Next.js (App Router), Tailwind, shadcn/ui, Geist
- Supabase: Postgres, Realtime, Storage, anonymous Auth
- MapLibre GL with OpenFreeMap tiles (OpenStreetMap data)
- **AI model: Google Gemma 4** (`gemma-4-31b-it`, open weights), called through the Gemini API with the `@google/genai` SDK. The model id is set by `AI_MODEL`. Model terms: https://ai.google.dev/gemma/terms

## Run locally

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run seed                 # buildings and sample events
npm run dev                  # http://localhost:3600
```

With `AI_MOCK=1` or no `GEMINI_API_KEY`, the AI routes return fixtures, so the app runs without a key.

## Project docs

- [Product plan](docs/plans/gator-radar.md)
- [Skeleton plan](docs/plans/01-skeleton.md)
- [Contracts](src/lib/contracts.md)
- [Hackathon rules](docs/reference/hackathon-rules.md)

## License

MIT. See [LICENSE](LICENSE).
