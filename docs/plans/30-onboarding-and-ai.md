# Round 4 plan: onboarding by role, and AI that needs our data

Status: plan only. Nothing here is built yet.

## Part 1: Onboarding

Problem: everyone is a guest and sees all four menu groups. It is confusing and nothing is protected.

Decided:
- Sign-in with an SFSU email code (type sfsu.edu email, get a code). No Google setup.
- Recruiters sign in with any work email and only see students who opted in.

Still open: how roles work (see the question in chat).

Proposed flow:
1. Landing, then "Open the map" leads to a welcome screen with three cards: Student, Faculty or staff, Recruiter.
2. Email code sign-in. Student and Faculty need an sfsu.edu address. Recruiter can use any email.
3. Student adds name, major, graduation year (the pickers we already have), and one switch: "Visible to recruiters" (off by default).
4. The sidebar shows only that role's group.
5. The "For clubs" group appears only after the person creates or joins a club.

Security:
- `profiles.role` column, set once at onboarding, not editable from the browser.
- Database rules check the role: recruiter search only returns opted-in students, help requests can only be created by faculty, club tools need club membership (already true).
- Pages for another role redirect home, and the API routes check the role too.

Risk: Supabase free plan sends only a few sign-in emails per hour. For the demo we keep a guest path or pre-made demo accounts.

## Part 2: What non-chatbot AI companies do (Browserbase research)

| Company | What the AI does | The lesson |
|---|---|---|
| Afresh | Tells grocery stores how much fresh food to order, with a confidence number, to cut waste | Forecast from your own messy data, show confidence |
| Coursedog | Schedules college classes, one school cut conflicts by 60% | Conflict detection is a real campus product |
| Reclaim | Moves calendar items to better slots, shows a preview, user approves | Suggest, preview, approve. Never change things silently |
| Ramp | Approves safe expenses by itself, escalates risky ones | AI acts inside rules, humans get the exceptions |
| Tennr | Turns a library of insurance rules into automatic decisions and collects missing proof | Policy documents become decisions |
| Reducto | Reads any document, returns structured data with a pointer to where each value came from, and fills forms | Extraction with citations, form filling |
| Hebbia, Elicit | Many documents become one table: each row a document, each column a question | Tables with sources, not chat answers |
| Clay | Enriches each row of data from many outside sources | Enrich our data with outside data |
| Glean | Indexes all company data and maps how things relate | Context is the product |
| Abridge | Listens to a doctor visit and writes the record, with published accuracy tests | Capture in the background, publish evals |

Shared pattern: none of them is a chat box. They own private data, the AI makes a decision or fills a record, every output shows its source, and a human approves.

## Part 3: AI for Gator Radar, built on that pattern

1. **Turnout and food forecast** (Afresh pattern). On the post form: "Expect 35 to 50 people. Order 5 pizzas." Code computes it from past check-ins for the club, building, weekday, hour and tag. AI explains the reason and gives a confidence level. After the event we show forecast vs actual.
2. **Clash check and best slot with real class schedules** (Coursedog and Reclaim pattern). We index the SFSU class schedule. When a club picks a time, we show which classes and events its audience is in at that time, and suggest two or three better slots with a preview. The host approves.
   - Finding: the SFSU class schedule page is public and has search by building. My automated search did not return results yet (the form answered "session expired"), so automatic loading is not confirmed. Fallback: load a few departments by hand into a `class_sections` table.
3. **Rules check from real SFSU policy** (Tennr pattern). Index SFSU event and food policies. On post: "Food for more than 50 people needs a food permit", with the quoted policy line. Needs research on which policy pages exist.
4. **Report autofill** (Reducto pattern). Fill the school's after-event or funding form from check-in data, each number linked to its source rows.
5. **Help request matching** replaces help request drafting. Match a professor's request to students by verified attendance, with a reason per student.
6. **Evals page** (Abridge pattern). Show our `npm run eval` results in the app, including forecast accuracy.

Remove: help request drafting, the unused event recap route.

Why a chatbot cannot do this: it has no check-ins, pickups, club history, building list or indexed class schedule, and it cannot act inside the post form.

## Build order

1. Onboarding and roles (one agent, touches shell, profiles, database rules).
2. Forecast (one agent).
3. Class index and clash check (one agent, starts with the loading research).
4. Matching, report autofill, rules check, evals page (as chosen).
