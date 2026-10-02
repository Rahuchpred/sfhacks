# Thread B (main): AI and integration

This is the plan for the main thread, the one that built the skeleton. It makes the AI real and owns everything shared.

## Where it works

| | |
|---|---|
| Folder | `/Users/rahazh/Documents/coding/sfhacks-new` |
| Branch | `main` |
| Dev server | `npm run dev` on port 3600 |

## What it owns

- `src/app/api/ai/**`, `src/lib/ai.ts`, `src/lib/ai-schemas.ts`, `src/lib/prompts/**`, `src/lib/fixtures/**`
- Every frozen file: `src/lib/types.ts`, `src/lib/db.ts`, `supabase/migrations`, `src/components/ui/**`, the shell, layout and globals
- Merging `thread/map` and `thread/food` into `main`
- README, deploy, demo script

## Part 1: make the AI real

1. **Model.** Call `/api/ai/ping` with the real key. Pick the Gemma 4 model from the list it returns and set `AI_MODEL`. Confirm it takes images.
2. **Reliability.** Confirm what Gemma supports (JSON mode, system instructions) and adjust `generateJson()`. Keep the zod validation and the single retry. Handle rate limits (429) with one short backoff and a clear error message.
3. **Extract event.** Tune the prompt on real inputs: at least 4 real SFSU flyers and 4 messy pasted texts. Buildings must resolve to a real building id, and unknown fields must come back null, never invented.
4. **Check event.** Do the checks that code can do exactly in code, not in the model: weekday versus date, past dates, end before start, missing required fields, unknown building id. Use the model only for the fuzzy parts: contradictions between flyer text and form values, and the follow-up questions. Merge both into one response.
5. **Estimate food.** Tune on real food photos. Compute `safeUntil` in code from the posted time and a model-returned category (hot or perishable: 2 hours, shelf-stable: 8 hours), so the time is never hallucinated. Portions lean low.
6. **Description and tags.** Include a clean description and consistent tags in the extract result, from a fixed tag list.
7. **Test set.** `scripts/eval.mjs` runs the saved inputs through each route and prints pass or fail per case, so prompt changes can be checked.
8. **Demo safety.** Save the real responses for the demo inputs as fixtures, so `AI_MOCK=1` replays a realistic demo if the network or the rate limit fails.

## Part 2: integration

1. Answer change requests from the other threads (`docs/plans/requests-map.md`, `docs/plans/requests-food.md`): add the db function, type or shadcn component on `main`, and tell them to `git merge main`.
2. Merge each thread when it reports ready: `git merge thread/map`, `git merge thread/food`. Run typecheck, lint and build after each merge, and click through the result.
3. Full run-through of the three demo features end to end with the real model:
   - a flyer photo becomes a pin on the map
   - the organizer check catches a wrong date before publishing
   - a food photo becomes a rescue that gets claimed
4. Deploy to Vercel with the env vars, and test the live URL.
5. README: name the Gemma model and link its terms, how AI is used, who at SFSU benefits, the responsible-AI section, the pilot path.
6. Demo script: a 3-minute walk through the three features, plus answers for likely judge questions.

## Subagents (1 to 5)

| Agent | Files | Job |
|---|---|---|
| 1 | `src/lib/checks.ts` | Deterministic event checks (weekday, past date, end before start, missing fields) with unit-style cases |
| 2 | `src/lib/prompts/**`, `scripts/eval.mjs`, `scripts/eval-cases/**` | Test inputs and the eval script |
| 3 | `README.md`, `docs/demo-script.md`, `docs/responsible-ai.md` | Writing, once the features are settled |

Prompt tuning and merging stay in the main thread, since they need judgment across the whole app.

## Rules for all three threads

- One folder and one branch per thread. Nobody edits another thread's files.
- Frozen files change only on `main`.
- Ports: 3600 main, 3601 map, 3602 food. Never 3000.
- Commit at every working checkpoint.
- No em dashes or en dashes anywhere.
