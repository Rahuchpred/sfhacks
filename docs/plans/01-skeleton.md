# Plan 01: Skeleton (one agent, 11:00 to 11:30)

Goal: a running, deployed, empty-but-wired app that three threads can build on without colliding. No features here, only the frame and the contracts.

Source docs: [gator-radar.md](gator-radar.md), [hackathon-rules.md](../reference/hackathon-rules.md).

## Done when

- [ ] `npm run dev` serves the app on **port 3600** (3000 is reserved)
- [ ] Shell renders: top bar, three tabs (Map, Food, Post), SFSU purple and gold, Geist font
- [ ] A Google Map centered on SFSU shows on the Map tab
- [ ] `src/lib/types.ts` and `src/lib/contracts.md` exist and are the single source of truth
- [ ] All three AI routes answer with mock JSON when `AI_MOCK=1`
- [ ] One real Gemini call works end to end (a `/api/ai/ping` smoke route)
- [ ] The app is live on a Cloud Run URL in the credited project
- [ ] Committed to `main`

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router, TypeScript), `output: "standalone"` | One codebase for UI and API routes, deploys to Cloud Run |
| UI | Tailwind + shadcn/ui | Asked for. Fast, consistent components |
| Font | Geist Sans + Geist Mono via `next/font/google` | Asked for |
| AI | Gemini through **Vertex AI**, using the `@google/genai` SDK | Runs on the hackathon Cloud credits (GDG rule) |
| AI (bonus) | One call through a **Gemma 4** model | Qualifies for the Gemma challenge |
| Data | Firestore | Realtime listeners make the map live for free |
| Files | Cloud Storage for Firebase | Flyer and food photos |
| Auth | Firebase Auth, anonymous sign-in | No login screen to build. SFSU SSO is the pilot story |
| Map | Google Maps JavaScript API via `@vis.gl/react-google-maps` | Another Google tool for the track |
| Hosting | Cloud Run (`gcloud run deploy --source .`) | Named in the handbook as a credit use |

## Google AI and Cloud: what we use, and for which rule

From the handbook, the GDG track needs: Gemini as an important part, at least one more Google tool, and the provided Cloud credits.

| Google thing | Used for | Rule it satisfies |
|---|---|---|
| Gemini (Vertex AI) | Flyer/voice/text to event, organizer data check, food photo estimate | Gemini is central, not a chatbot |
| Structured output (JSON schema) | Every AI route returns typed JSON, never free text | Reliability for the demo |
| Gemini multimodal input | Flyer images, food photos, voice notes | "Meaningful function" for the SFSU track |
| Gemma 4 | Auto description and tags (small, cheap text task) | Gemma challenge |
| Cloud Run | Hosting | Cloud credits |
| Firestore | Events, food rescues, claims | Extra Google tool + credits |
| Cloud Storage | Uploaded images | Credits |
| Firebase Auth | Anonymous users | Extra Google tool |
| Maps JavaScript API | The campus map | Extra Google tool |
| Google AI Studio | Prompt drafting before code | Named in the handbook |

Verify at 11:00, do not guess:

- The exact current Gemini Flash model id and Gemma 4 model id (check the Vertex AI model list)
- Whether Gemma 4 is callable from Vertex with the same SDK, or needs a Gemini API key from AI Studio. If it needs the key, only that one route uses it
- That the GCP project in use is the one the hackathon credits were applied to

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
   Set the dev script to `next dev -p 3600`. Set `output: "standalone"` in the Next config.

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

8. **AI client**: `src/lib/ai.ts` wraps `@google/genai` in Vertex mode with one helper, `generateJson(prompt, parts, schema)`. Mock mode returns fixtures from `src/lib/fixtures/`.

9. **Map**: `<CampusMap />` centered on 37.7241, -122.4799, zoom 16.

10. **Seed**: `scripts/seed.ts` writes about 15 SFSU buildings and 8 sample events to Firestore.

11. **Deploy**: `gcloud run deploy gator-radar --source . --region us-west1 --allow-unauthenticated`. Open the URL on a phone.

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
  flyerUrl: string | null;
  source: "organizer" | "flyer" | "seed";
  createdBy: string;  // uid
};

type FoodRescue = {
  id: string;
  eventId: string | null;
  buildingId: string;
  room: string | null;
  photoUrl: string;
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
| `POST /api/ai/extract-event` | `{ text?: string; imageUrl?: string; audioUrl?: string }` | `{ event: Partial<CampusEvent>; missing: string[]; confidence: number }` |
| `POST /api/ai/check-event` | `{ event: Partial<CampusEvent> }` | `{ ok: boolean; issues: { field: string; message: string; severity: "error" \| "warn" }[]; questions: string[] }` |
| `POST /api/ai/estimate-food` | `{ imageUrl: string; postedAt: string }` | `{ items: string; portions: number; dietary: string[]; safeUntil: string; note: string }` |
| `POST /api/claims` | `{ rescueId: string }` | `{ ok: boolean; portionsLeft: number }` (Firestore transaction) |

### Folder ownership

| Folder | Owner |
|---|---|
| `src/app/(student)/map`, `src/components/map` | Thread A |
| `src/app/api/ai`, `src/lib/ai.ts`, `src/lib/prompts` | Thread B |
| `src/app/(student)/food`, `src/app/post`, `src/app/api/claims` | Thread C |
| `src/lib/types.ts`, `src/components/ui`, `globals.css`, `layout.tsx` | Frozen. Change only by asking in the main thread |

## Needed from you before 11:00

1. The GCP project id that has the hackathon credits, with `gcloud` logged in on this Mac
2. A Firebase project on that same GCP project (Firestore, Storage and Anonymous Auth turned on)
3. A Maps JavaScript API key
4. Yes or no on making the repo public (required for the open-source track)

## Cut line

If the skeleton runs past 11:40: skip the seed script (hardcode fixtures), skip the Gemma route, and deploy to Cloud Run later in Phase 2. Do not skip the contracts.
