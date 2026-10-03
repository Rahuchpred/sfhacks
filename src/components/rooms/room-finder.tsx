"use client";

// Free rooms right now, per building, from the real SF State class schedule.
import { useEffect, useState } from "react";
import { DoorOpen, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { listBuildings } from "@/lib/db";
import type { Building } from "@/lib/types";
import { cn } from "@/lib/utils";

type Room = {
  room: string;
  capacity: number;
  free: boolean;
  until: number | null;
  className: string | null;
  classesToday: number;
};

function clock(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

export function RoomFinder() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [building, setBuilding] = useState("thornton");
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listBuildings().then(setBuildings).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/campus/rooms?building=${encodeURIComponent(building)}`)
      .then((response) => response.json())
      .then((data: { rooms?: Room[] }) => {
        if (cancelled) return;
        setRooms(data.rooms ?? []);
        setError(!data.rooms);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [building]);

  const free = rooms?.filter((room) => room.free).length ?? 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Free rooms right now</h1>
          <p className="mt-1 text-sm text-muted-foreground">From the real Fall 2026 class schedule</p>
        </div>
        {rooms && (
          <p className="text-sm font-medium tabular-nums">
            <span className="text-2xl font-semibold text-emerald-600">{free}</span> of {rooms.length} free
          </p>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {buildings.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === building}
            onClick={() => {
              setRooms(null);
              setBuilding(item.id);
            }}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              item.id === building ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">Could not load rooms. Try again.</p>
      ) : rooms === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="status" aria-label="Loading rooms">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <DoorOpen aria-hidden className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No classrooms in the schedule for this building</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {rooms.map((room, index) => (
            <li
              key={room.room}
              style={{ animationDelay: `${Math.min(index, 20) * 25}ms` }}
              className={cn(
                "flex animate-in flex-col gap-2 rounded-xl border p-3.5 duration-300 fill-mode-both fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none",
                room.free ? "border-emerald-600/30 bg-emerald-50/60" : "bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold tracking-tight">{room.room}</span>
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    room.free ? "bg-emerald-500 motion-safe:animate-pulse" : "bg-muted-foreground/40",
                  )}
                />
              </div>
              <p className={cn("text-sm font-medium", room.free ? "text-emerald-700" : "text-muted-foreground")}>
                {room.free
                  ? room.until
                    ? `Free until ${clock(room.until)}`
                    : "Free rest of day"
                  : `${room.className} until ${clock(room.until ?? 0)}`}
              </p>
              <p className="mt-auto flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <Users aria-hidden className="size-3.5" />
                {room.capacity} seats, {room.classesToday} classes today
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
