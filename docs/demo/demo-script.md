# Demo script: 5 minutes, AI first

Before you start: dev server running on port 3600. Sign in with the code 000000. Three tabs:
- localhost:3600 = owner@demo.gatorradar.test (club owner)
- 127.0.0.1:3600 = member@demo.gatorradar.test (club member)
- gator.localhost:3600 = student@demo.gatorradar.test (student, no club)

Say first: "The class schedule and police notices are real. The events and students are sample data."
Show only what works. Skip anything marked RISKY if it fails once.

## 0:00 The problem (30 seconds)
SpaceX asked me to host a build night at SF State. I could not find a club, a room or the rules.
It is all scattered. So I built one place.

## 0:30 AI 1: say your idea, get a room (owner tab, /post) [the main one]
1. Press the mic, say: "Design club Figma workshop next week in the afternoon, about 30 people, with snacks, one hour."
   (RISKY: the first mic use downloads a 72 MB speech model. Do it once before judges arrive. If it fails, type the same sentence.)
2. The words land in the box. Fix a word to show you can edit. Press "Plan it".
3. Point at: what it understood, the turnout range, and the three rooms with seats, time and reason.
Say: "Speech to text runs on my laptop. Gemma 4 understands the idea. Code finds the rooms from the real class schedule, 3,741 sections, so the AI can never invent a room."
4. Press "Use this". The form fills in and scrolls down.

## 1:45 AI 2: flyer to event (owner tab, /post)
Drop the ChatGPT flyer in the box. The form fills itself, no button.
Say: "AI reads the flyer once. Validation is plain code."

## 2:15 The map (any tab, /map)
Show: pins with time labels, the live event glowing, the map type menu, 3D buildings on.
Say: "Students see everything on one map." (Optional: Busy right now on, at a busy hour.)

## 2:45 Three roles, one app (three tabs side by side)
- Student tab: map, free food, tickets, Messages. No club tools.
- Member tab: Dashboard and Leftover food only. Open Analytics: "Organizers only".
- Owner tab: Analytics, Reports, Leftover food.
Say: "The database enforces this, not just the menu."

## 3:30 AI 3: insights for organizers (owner tab, /host/analytics)
Show the charts by major and the AI insights card. (Press "Find insights" if it is a button.)
Say: "Real check-ins and the class schedule tell a club who it is missing."

## 4:00 Campus safety (two tabs)
Switch a demo account to the Safety role, open "Post an alert", click the map, post it.
Open /map in another tab: the red circle with the time appears live. Press "All clear".
Say: "Only the safety role can post. No AI touches the text."

## 4:30 Faculty and close
Faculty role: /faculty/attendance, pick an event, paste a class list.
Close: "Faculty get attendance, students get one map, clubs get a room. Next: a pilot with one club and one department."

## If a judge asks about responsible AI
- Privacy: speech stays on the device. Recruiters only see students who opt in. Faculty see door check-ins only.
- Bias: the AI never decides facts. Code checks rooms, times and numbers.
- Access: AI suggestions never block posting. Everything works without AI.
- Risk: AI quota. Everything has a plain fallback.

## Backup plan
Record this whole run once on your phone before 4:45. If the Wi-Fi or the AI quota fails, play it.
