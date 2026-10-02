# Gator Radar (working name)

A live map of everything happening at SF State: club events, workshops, stands, talks. AI fills the map from messy flyers and posts, rescues leftover event food for students who need it, and helps clubs publish clean event data.

Track: **Build for SFSU**. Also meets GDG track rules if Gemini + a Google Cloud service are used (they are).

> Status: sections 1-3 and 4.5 are copied in full from the original plan. Sections 4.1-4.4, 4.6 and 5-13 are only outlined here (see "Still to bring over" at the bottom).

---

## 1. Problem

- Campus events are scattered across Instagram flyers, wall posters, Discord, email newsletters and the university calendar. Nobody sees the full picture, so students miss things and clubs get low turnout.
- Most SFSU students commute and leave right after class, so they miss campus life (belonging matters for retention).
- Food insecurity: 73% of students reported it in SFSU's 2020 Basic Needs survey. At the same time, food left over from events gets thrown away.
- Event data that clubs enter by hand is often wrong or incomplete (missing room, wrong date, stale events).

## 2. Who benefits

| Who | How |
|---|---|
| Students | See everything on one map, get free food alerts, find events that fit between classes |
| Clubs and orgs | Post events in seconds, avoid clashes, better turnout |
| Basic Needs office | Meals served and food rescued, as data |
| Sustainability office | Pounds of food kept out of the trash |
| Student Activities / Associated Students | Clean, complete event data and reports |

## 3. Why AI is essential (not a chatbot)

Without AI the map is empty, because nobody types every event in by hand. The AI:

1. **Turns messy input into structured events** (flyer photos, screenshots, voice notes, pasted text).
2. **Resolves fuzzy locations** ("Caesar Chavez 109", "outside the library", "the Quad") to real buildings.
3. **Merges duplicates** across sources.
4. **Estimates leftover food from a photo** (portions, diet) and sets a food-safety "safe until" time.
5. **Decides who to alert** so 40 people don't run for 14 slices.
6. **Checks organizers' data before publishing** (date/weekday mismatch, missing room, past dates).
7. **Plans a student's week** around their class gaps and explains every pick.

A chatbot can't do this: it's a shared, live map with many users, it acts over time, and it coordinates people.

---

## 4. Features (MVP / Next / Later)

Feature areas:

- 4.1 Campus map
- 4.2 Getting events onto the map (flyer → pin)
- 4.3 Food Rescue (the main feature)
- 4.4 My Week planner
- 4.5 Organizer tools (below)
- 4.6 Accounts, safety and responsible AI

### 4.5 Organizer tools

The biggest risk for any event map is bad data: wrong rooms, missing times, outdated events. Fixing data where the club enters it is better than cleaning it up afterward. It also makes the AI work for both sides: students and organizers.

**Creating events**

| Feature | What the AI does | Tier |
|---|---|---|
| Create from anything | Paste rough text, record a voice note or upload a flyer, and Gemini fills in the whole event form | MVP |
| Missing-info check | Asks only for what's missing: "What's the end time?", "Which room in HSS?", "Is there food? Any allergens?" | MVP |
| Error catching | Flags contradictions before publishing: the flyer says "Thursday Oct 9" but Oct 9 is a Friday, the room doesn't exist, the date has already passed, or the flyer and form disagree | MVP |
| Auto description and tags | Writes a clear short description and picks categories, so the map's filters work consistently | MVP |
| Recurring events | "Every Tuesday at 1" becomes a weekly series instead of one event | Next |

**Better reach**

| Feature | What the AI does | Tier |
|---|---|---|
| Clash warnings | "2 other cultural events overlap with yours in the same building" | Next |
| Best time slot | Suggests a better time based on how many classes end nearby, and explains why | Later |
| Flyer feedback | "Your room number isn't on the flyer," "The text is too low-contrast to read" | Next |
| Accessible versions | Alt text for the flyer, plus Spanish and Chinese translations | Later |

**Keeping data fresh**

| Feature | What the AI does | Tier |
|---|---|---|
| Quick updates | Voice note "we moved to HSS 210," and the event updates and notifies students who claimed or planned it | Next |
| Stale event cleanup | Asks the club "Is this still happening?" when an event has no activity or looks outdated | Later |
| Club profile builder | Builds the club's page from its Instagram bio or Linktree | Later |

**After the event**

| Feature | What the AI does | Tier |
|---|---|---|
| Leftover food post | The Food Rescue photo flow, started from the club dashboard in one tap | MVP |
| Voice debrief | "About 30 came, lots of pizza left" is saved as turnout and leftover data, which improves the time-slot suggestions | Later |
| Club report | Monthly summary: events held, turnout, meals rescued. Useful for Associated Students funding requests | Later |

**Why judges will like this**

- More people benefit: clubs and Student Activities staff, not just students.
- Clear data story: the AI checks events when they're entered, so the map stays reliable.
- Realistic pilot: Associated Students could require clubs to post through it, and clubs get better turnout in return.

**Responsible-AI note:** no AI analysis of crowd photos for attendance. Turnout comes from claims, RSVPs or the organizer's own count, so no faces are ever processed.

**Organizer demo (about 30 seconds)**

1. A club officer records a 10-second voice note.
2. Gemini fills in the event and flags that the date and the weekday don't match.
3. The officer fixes it, publishes, and the pin appears on the map.

---

## Still to bring over

These sections exist in the original `PLAN.md` but were not in the pasted text:

- 4.1-4.4 and 4.6: feature tables for the map, flyer → pin, Food Rescue, My Week, accounts and safety
- 5. Architecture: Cloud Run endpoints, Gemini, Firestore, Maps, Auth, push alerts, Browserbase
- 6. Database design: buildings, events, food rescues, claims, users
- 7. AI design: exact JSON output for flyer reading, the organizer check, food estimates, who gets alerted, the week planner and duplicate merging
- 8. Hour-by-hour build plan for two people, with a "cut line" for what to drop if behind
- 9. 3-minute demo script
- 10. Responsible-AI table: each risk and how it's handled
- 11. Pilot path at SFSU
- 12. What to learn from: Luma, Replate, MIT's free-food list, Alli Chat
- 13. Checklist of things to verify first
