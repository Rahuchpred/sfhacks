# Demo script: 2 minutes, everything

Before: restart the dev server. Three tabs, code 000000:
- localhost:3600 = owner@demo.gatorradar.test
- 127.0.0.1:3600 = member@demo.gatorradar.test
- gator.localhost:3600 = student@demo.gatorradar.test
Try the mic once beforehand (72 MB speech model downloads on first use). Flyer on the desktop. /post open in the owner tab, /map in the student tab.

0:00 The problem (student tab, /map)
"SpaceX asked me to host a build night at SF State and I could not find a club, a room or the rules. It is all scattered. So I built Gator Radar. Every event, free food and the time on each pin." Show pin labels, turn on 3D.

0:15 AI 1: speak an event, get a room (owner tab, /post)
Mic: "Design club Figma workshop next week in the afternoon, about 30 people, with snacks, one hour." Edit one word, press Plan it.
"Speech to text runs on my laptop. Gemma 4 understands the idea. The rooms come from the real class schedule, 3,741 classes, so the AI cannot invent a room." Press Use this.

0:50 AI 2: flyer
Drop the poster. The form fills itself.

1:05 Three roles, enforced by the database
Student: map, food, tickets, messages. Member: door check-in and leftover food only, Analytics says "Organizers only". Owner: everything.

1:25 AI 3 and data (owner tab, /host/analytics)
"Who comes, by major, plus AI insights from real check-ins. Reports copy into Google Sheets for the school."

1:45 Safety and close
Safety role posts an alert. The red circle appears live in the student tab. All clear.
"Only that role can post, no AI touches the text. Faculty get attendance and a help board. Next: a pilot with one club and one department."

If something fails: skip it and keep talking.
Responsible AI, one line each: speech stays on the device; code decides facts, not AI; recruiters only see opted-in students; everything works without AI.
Say once: the class schedule and police notices are real, the events and students are sample data.
