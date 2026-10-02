"use client";

import { CampusMap } from "@/components/map/campus-map";
import { Badge } from "@/components/ui/badge";
import { useCampus } from "@/lib/use-campus";

const timeFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

// Starter layout: event list on the left, map on the right. Thread A builds on this.
export default function MapPage() {
  const { buildings, events, rescues, loading, error } = useCampus();
  const buildingName = new Map(buildings.map((building) => [building.id, building.name]));

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row">
      <aside className="order-2 flex max-h-[45%] min-h-0 flex-col border-t md:order-1 md:max-h-none md:w-96 md:shrink-0 md:border-t-0 md:border-r">
        <div className="border-b px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Happening on campus</h1>
          <p role="status" className="mt-0.5 text-sm text-muted-foreground">
            {error ?? (loading ? "Loading…" : `${events.length} events · ${rescues.length} food rescues`)}
          </p>
        </div>

        <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
          {events.map((event) => (
            <li key={event.id} className="px-5 py-3.5">
              <p className="text-sm font-medium">{event.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {timeFormat.format(new Date(event.startsAt))} ·{" "}
                {buildingName.get(event.buildingId) ?? "On campus"}
                {event.room ? `, ${event.room}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {event.hasFood && (
                  <Badge className="bg-accent text-accent-foreground">Free food</Badge>
                )}
                <Badge variant="secondary">{event.clubName}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <div className="relative order-1 min-h-0 flex-1 md:order-2">
        <CampusMap buildings={buildings} events={events} rescues={rescues} />
      </div>
    </div>
  );
}
