"use client";

import { useRef, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { claimPortion } from "@/lib/db";
import type { Building, FoodRescue } from "@/lib/types";
import { Countdown, formatClock } from "./countdown";

type RescueCardProps = {
  rescue: FoodRescue;
  building: Building | undefined;
  now: number; // ms from the grid's shared clock
  held: boolean; // this browser already claimed it
  onClaimed: (rescue: FoodRescue) => void;
};

// "Cesar Chavez Student Center, Rosa Parks A-C", or "Campus" with no building.
export function placeLabel(building: Building | undefined, room: string | null): string {
  const name = building?.name ?? "Campus";
  return room ? `${name}, ${room}` : name;
}

export function RescueCard({ rescue, building, now, held, onClaimed }: RescueCardProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Set once the server says this rescue can no longer be claimed.
  const [closed, setClosed] = useState(false);
  // A ref, because two clicks can land before the pending state re-renders.
  const busy = useRef(false);

  const place = placeLabel(building, rescue.room);
  const safeTime = formatClock(rescue.safeUntil);
  const left = Math.max(0, Math.min(rescue.portionsLeft, rescue.portions));
  const percent = rescue.portions > 0 ? (left / rescue.portions) * 100 : 0;

  async function claim() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage(null);

    try {
      const result = await claimPortion(rescue.id);
      if (result.ok) {
        onClaimed(rescue);
        toast.success("Portion held for you", {
          description: `Pick it up at ${place} before ${safeTime}.`,
        });
        return;
      }
      switch (result.reason) {
        case "already_claimed":
          onClaimed(rescue);
          toast.info("You already hold a portion here");
          break;
        case "gone":
          setClosed(true);
          setMessage("All portions were just claimed.");
          break;
        case "expired":
          setClosed(true);
          setMessage("This food is past its safe-until time.");
          break;
        case "not_found":
          setClosed(true);
          setMessage("This post was removed.");
          break;
        case "not_signed_in":
          setMessage("Still connecting you. Try again in a moment.");
          break;
        default:
          setMessage("Could not claim. Check your connection and try again.");
      }
    } catch {
      setMessage("Could not claim. Check your connection and try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <Card className="h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={rescue.photoUrl}
        alt={`Photo of ${rescue.items}`}
        width={800}
        height={600}
        loading="lazy"
        className="aspect-[4/3] w-full bg-muted object-cover"
      />

      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="line-clamp-2 font-heading text-base leading-snug font-medium text-pretty break-words">
            {rescue.items}
          </h3>
          <p className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 text-pretty break-words">{place}</span>
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="tabular-nums">
            <span className="font-medium">
              {left} of {rescue.portions}
            </span>{" "}
            portions left
          </p>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {rescue.dietary.length > 0 && (
          <ul aria-label="Dietary tags" className="flex flex-wrap gap-1.5">
            {rescue.dietary.map((tag) => (
              <li key={tag} className="flex">
                <Badge variant="outline">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}

        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span>Safe until {safeTime}</span>
          <Countdown until={rescue.safeUntil} now={now} className="text-muted-foreground" />
        </p>

        <p className="text-xs text-pretty text-muted-foreground">
          Dietary tags are AI estimates. If you have an allergy, ask the organizer before eating.
        </p>

        <div className="mt-auto space-y-2">
          {held ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-accent/40 bg-accent/15 p-3">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Your portion is held</p>
                <p className="text-pretty break-words text-muted-foreground">
                  Pick it up at {place} before {safeTime}.
                </p>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              className="h-10 w-full bg-accent text-accent-foreground hover:bg-accent/85"
              disabled={pending || closed}
              onClick={claim}
            >
              {pending ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                  Claiming…
                </>
              ) : (
                "Claim a portion"
              )}
            </Button>
          )}
          {/* Always mounted so screen readers announce a message when it appears. */}
          <p
            role="status"
            aria-live="polite"
            className="text-pretty text-muted-foreground empty:hidden"
          >
            {held ? null : message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
