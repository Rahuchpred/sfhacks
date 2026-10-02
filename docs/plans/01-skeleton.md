# Plan 01: Skeleton (one agent, 11:00 to 11:30)

Goal: a running, deployed, empty-but-wired app that three threads can build on without colliding. No features here, only the frame and the contracts.

Source docs: [gator-radar.md](gator-radar.md), [hackathon-rules.md](../reference/hackathon-rules.md).

## Done when

- [ ] `npm run dev` serves the app on **port 3600** (3000 is reserved)
- [ ] Shell renders: top bar, three tabs (Map, Food, Post), SFSU purple and gold, Geist font
- [ ] A MapLibre map centered on SFSU shows on the Map tab
- [ ] `src/lib/types.ts` and `src/lib/contracts.md` exist and are the single source of truth
- [ ] All three AI routes answer with mock JSON when `AI_MOCK=1`
- [ ] One real Gemma call works end to end (a `/api/ai/ping` smoke route)
- [ ] The app is live on a Vercel URL
- [ ] Committed to `main`

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router, TypeScript) | One codebase for UI and API routes |
| UI | Tailwind + shadcn/ui | Asked for. Fast, consistent components |
| Font | Geist Sans + Geist Mono via `next/font/google` | Asked for |
| AI | **Gemma 4** through the Gemini API, using the `@google/genai` SDK and a free AI Studio key | No credits or card needed. Qualifies for the Gemma challenge |
| Data | Firestore (free Spark plan) | Realtime listeners make the map live for free |
| Files | None. Images go to the model as base64 and are stored as small data URLs or not at all | Cloud Storage needs billing on new projects |
| Auth | Firebase Auth, anonymous sign-in | No login screen to build. SFSU SSO is the pilot story |
| Map | MapLibre GL with OpenStreetMap tiles, via `react-map-gl/maplibre` | Free, no key, fits the open-source track |
| Hosting | Vercel free tier | Cloud Run needs a billing account |

## Free setup: no Cloud credits

Decision (Oct 2): build on the free tier only. Nothing here needs a billing account.

| Track | Eligible? | Why |
|---|---|---|
| Build For SFSU (cash) | Yes | Only requires meaningful AI |
| Best Use of Gemma 4 | Yes | Gemma through the Gemini API is the requirement |
| Best Open-Source AI | Yes, if the repo is public with a license | Gemma is open-weight |
| GDG Social Good | No | Requires Gemini plus the provided Cloud credits |

**Switch back path:** the model id lives in one env var, `AI_MODEL`. If credits arrive at the opening ceremony, set it to a Gemini model, deploy to Cloud Run, and the GDG track is back on.

| Piece | Used for |
|---|---|
| Gemma 4 (image + text input) | Flyer or pasted text to event, organizer data check, food photo estimate, description and tags |
| Firestore | Events, food rescues, claims |
| Firebase Auth | Anonymous users |
| Google AI Studio | The API key, and prompt drafting before code |

Test in the first ten minutes, do not guess:

- The exact Gemma 4 model id (list models with the API key)
- **JSON mode:** whether Gemma 4 accepts `responseSchema`. If not, ask for JSON in the prompt, strip code fences, and validate with zod, retrying once on a parse failure
- **System instructions:** earlier Gemma models rejected them. If so, put the instructions at the top of the user prompt
- **Audio:** whether Gemma 4 takes audio. If not, "create from voice note" is cut and the organizer demo uses a flyer photo or pasted text
- Free tier rate limits, so the demo does not hit a 429. Cache the demo responses as fixtures either way

## Design tokens

SFSU brand colors (verify against the SF State identity page before the demo):

| Token | Value | Use |
|---|---|---|
| `--primary` | `#463077` (SF State purple) | Top bar, primary buttons, event pins |
| `--accent` | `#C99700` (SF State gold) | Food Rescue pins, highlights, badges |
| `--background` | `#FFFFFF` | Page |
| `--foreground` | `#1B1530` | Text (near-black with a purple tint) |
| `--muted` | `#F4F2F8` | Cards, sheets |

Rules: purple is for events, gold is for food, so the map reads at a glance. Gold never carries white text (contrast fails), use the dark foreground on gold.

## Steps

1. **Scaffold**
   ```bash
   npx create-next-app@latest . --typescript --tailwind --app --src-dir --eslint --use-npm --yes
   ```
   Set the dev script to `next dev -p 3600`.

2. **shadcn**
   ```bash
   npx shadcn@latest init -d
   npx shadcn@latest add button card sheet tabs badge input textarea dialog sonner skeleton
   ```
   Then replace the color variables in `globals.css` with the tokens above.

3. **Design guidelines skill**
   ```bash
   npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
   ```
   Every UI thread runs this skill on its screens before merging.

4. **Geist**: load `Geist` and `Geist_Mono` from `next/font/google` in `layout.tsx`, wire to `--font-sans` and `--font-mono`.

5. **App shell**: top bar with the name, bottom tab bar (Map, Food, Post), mobile-first at 390px wide. Each tab is a route with a placeholder.

6. **Shared types and contracts** (the most important step, see below).

7. **Firebase**: `src/lib/firebase.ts` (client) and `src/lib/firebase-admin.ts` (server), anonymous sign-in on load.

8. **AI client**: `src/lib/ai.ts` wraps `@google/genai` with `GEMINI_API_KEY` and `AI_MODEL`, exposing one helper, `generateJson(prompt, parts, zodSchema)`, which parses, validates and retries once. Mock mode returns fixtures from `src/lib/fixtures/`.

9. **Map**: `<CampusMap />` with MapLibre and OpenStreetMap tiles, centered on 37.7241, -122.4799, zoom 16. Keep the OSM attribution visible.

10. **Seed**: `scripts/seed.ts` writes about 15 SFSU buildings and 8 sample events to Firestore.

11. **Deploy**: `vercel --prod` with the env vars set. Open the URL on a phone.

12. **Commit and push** to `main`. Threads branch from this commit.

## Contracts (written in step 6, frozen after)

### Firestore collections

```ts
type Building = { id: string; name: string; aliases: string[]; lat: number; lng: number };

type CampusEvent = {
  id: string;
  title: string;
  description: string;
  clubName: string;
  buildingId: string;
  room: string | null;
  startsAt: string;   // ISO 8601
  endsAt: string;
  tags: string[];
  hasFood: boolean;
  flyerUrl: string | null;  // data URL, downscaled to under 200 KB
  source: "organizer" | "flyer" | "seed";
  createdBy: string;  // uid
};

type FoodRescue = {
  id: string;
  eventId: string | null;
  buildingId: string;
  room: string | null;
  photoUrl: string;       // data URL, downscaled to under 200 KB
  items: string;          // "cheese pizza, veggie wraps"
  portions: number;
  portionsLeft: number;
  dietary: string[];      // "vegetarian", "halal", "contains nuts"
  safeUntil: string;      // ISO 8601
  status: "open" | "gone" | "expired";
  createdBy: string;
};

type Claim = { id: string; rescueId: string; uid: string; createdAt: string };
```

### API routes

| Route | Input | Output |
|---|---|---|
| `POST /api/ai/extract-event` | `{ text?: string; imageBase64?: string }` | `{ event: Partial<CampusEvent>; missing: string[]; confidence: number }` |
| `POST /api/ai/check-event` | `{ event: Partial<CampusEvent> }` | `{ ok: boolean; issues: { field: string; message: string; severity: "error" \| "warn" }[]; questions: string[] }` |
| `POST /api/ai/estimate-food` | `{ imageBase64: string; postedAt: string }` | `{ items: string; portions: number; dietary: string[]; safeUntil: string; note: string }` |
| `POST /api/claims` | `{ rescueId: string }` | `{ ok: boolean; portionsLeft: number }` (Firestore transaction) |

### Folder ownership

| Folder | Owner |
|---|---|
| `src/app/(student)/map`, `src/components/map` | Thread A |
| `src/app/api/ai`, `src/lib/ai.ts`, `src/lib/prompts` | Thread B |
| `src/app/(student)/food`, `src/app/post`, `src/app/api/claims` | Thread C |
| `src/lib/types.ts`, `src/components/ui`, `globals.css`, `layout.tsx` | Frozen. Change only by asking in the main thread |

## Needed from you before 11:00

1. A free Gemini API key from Google AI Studio (aistudio.google.com), put in `.env.local` as `GEMINI_API_KEY`. Do not paste it in chat
2. A Firebase project on the free Spark plan, with Firestore and Anonymous Auth turned on, and its web config
3. Yes or no on making the repo public (required for the open-source track)

## Cut line

If the skeleton runs past 11:40: skip the seed script (hardcode fixtures) and deploy to Vercel later in Phase 2. Do not skip the contracts.
