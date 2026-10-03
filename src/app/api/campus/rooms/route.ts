import { loadCampus } from "@/lib/db-planner";
import { campusTime, normalizeRoom } from "@/lib/planner";

// GET /api/campus/rooms?building=<id>: every classroom in a building and whether it is
// free right now, from the real class schedule. Code only, no AI.
export async function GET(request: Request) {
  const building = new URL(request.url).searchParams.get("building") ?? "";
  try {
    const { campus } = await loadCampus();
    const now = campusTime(new Date());
    const rooms = campus.rooms
      .filter((room) => room.buildingId === building)
      .map((room) => {
        const today = (campus.byDay.get(now.weekday) ?? [])
          .filter(
            (s) =>
              s.buildingId === building &&
              s.room &&
              normalizeRoom(s.room) === normalizeRoom(room.room) &&
              (!s.startsOn || now.date >= s.startsOn) &&
              (!s.endsOn || now.date <= s.endsOn),
          )
          .sort((a, b) => a.startMinute - b.startMinute);
        const current = today.find((s) => s.startMinute <= now.minute && now.minute < s.endMinute);
        const next = today.find((s) => s.startMinute > now.minute);
        return {
          room: room.room,
          capacity: room.capacity,
          free: !current,
          // Minutes after midnight, campus time.
          until: current ? current.endMinute : (next?.startMinute ?? null),
          className: current ? `${current.subject} ${current.number}` : next ? `${next.subject} ${next.number}` : null,
          classesToday: today.length,
        };
      })
      .sort((a, b) => Number(b.free) - Number(a.free) || b.capacity - a.capacity);
    return Response.json({ rooms, minute: now.minute });
  } catch {
    return Response.json({ error: "Could not load rooms." }, { status: 500 });
  }
}
