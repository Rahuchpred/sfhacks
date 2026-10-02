"use client";

// Reference: Calendly "New one-off meeting", the Selections card (Mobbin, web):
// a small summary block of icon rows with the offered times listed under it.
import { useEffect, useState } from "react";
import { CalendarClock, Clock, Users, Utensils } from "lucide-react";
import type { PlanOption, PlannerCheckRequest, PlannerCheckResponse } from "@/lib/planner-types";
import { cn } from "@/lib/utils";
import { clockLabel, dayLabel, peopleRange, rangeLabel, shareLabel } from "./format";
import { checkSlot } from "./planner-api";

// The check waits until the organizer has stopped changing the place and time.
const PAUSE_MS = 500;

type SlotCheckProps = {
  // Null until a building, a start and an end are set.
  request: PlannerCheckRequest | null;
  onApply: (slot: PlanOption) => void;
  className?: string;
};

// Forecast and clashes for the chosen place and time. Code only, no AI. It is
// information, never a problem: it does not block publishing, and when the
// check fails the card simply stays away.
export function SlotCheck({ request, onApply, className }: SlotCheckProps) {
  const key = request ? JSON.stringify(request) : null;
  const [checked, setChecked] = useState<{ key: string; data: PlannerCheckResponse } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkSlot(JSON.parse(key) as PlannerCheckRequest)
        .then((data) => {
          if (!cancelled) setChecked({ key, data });
        })
        .catch(() => {
          if (!cancelled) setChecked(null);
        });
    }, PAUSE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  if (!key || !request || !checked) return null;
  const { forecast, clashes, betterSlots } = checked.data;
  const stale = checked.key !== key;
  const row = "flex items-start gap-2 text-sm";
  const icon = "mt-0.5 size-4 shrink-0 text-muted-foreground";

  return (
    <section
      aria-label="Forecast"
      aria-busy={stale}
      className={cn(
        "flex animate-in flex-col gap-2 rounded-xl border border-dashed p-3 transition-opacity duration-200 ease-out fade-in-0 slide-in-from-top-1 motion-reduce:animate-none",
        stale && "opacity-50",
        className,
      )}
    >
      <p className={row}>
        <Users className={icon} aria-hidden />
        <span className="min-w-0">
          <span className="font-medium tabular-nums">Expect {peopleRange(forecast)}</span>
          <span className="text-muted-foreground"> · {forecast.reason}</span>
        </span>
      </p>

      {forecast.food && (
        <p className={row}>
          <Utensils className={icon} aria-hidden />
          <span className="tabular-nums">Food for {forecast.food.portions}</span>
        </p>
      )}

      {clashes.map((clash) => (
        <p key={`${clash.kind}|${clash.label}|${clash.startsAt}`} className={row}>
          <Clock className={icon} aria-hidden />
          <span className="min-w-0 break-words">
            {clash.label}
            <span className="text-muted-foreground tabular-nums">
              {" · "}
              {rangeLabel(clash.startsAt, clash.endsAt)}
              {shareLabel(clash) && ` · ${shareLabel(clash)}`}
            </span>
          </span>
        </p>
      ))}

      {betterSlots.length > 0 && (
        <div className={cn(row, "items-center")}>
          <CalendarClock className={cn(icon, "mt-0")} aria-hidden />
          <span className="shrink-0 text-muted-foreground">Better</span>
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {betterSlots.map((slot) => {
              const sameDay = dayLabel(slot.startsAt) === dayLabel(request.startsAt);
              const moved = slot.buildingId !== request.buildingId;
              return (
                <li key={`${slot.buildingId}|${slot.room}|${slot.startsAt}`}>
                  <button
                    type="button"
                    title={slot.reason}
                    onClick={() => onApply(slot)}
                    className="h-8 touch-manipulation rounded-full border border-transparent bg-muted px-3 text-sm tabular-nums transition-[color,background-color,border-color,scale] duration-150 outline-none hover:bg-primary/10 hover:text-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:active:scale-100"
                  >
                    {!sameDay && `${dayLabel(slot.startsAt).split(",")[0]} `}
                    {clockLabel(slot.startsAt)}
                    {moved && <span className="text-muted-foreground"> · {slot.buildingName}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
