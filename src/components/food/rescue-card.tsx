"use client";

// Mobbin reference: Sweatpals "You're in!" ticket confirmation (web), for the
// card that pairs a photo with the event name, the place and one action.

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";
import { Countdown, formatClock, HoldTimer } from "./countdown";
import { PickupCode } from "./pickup-code";
import type { ClaimOutcome } from "./pickups";
import type { Pickup } from "./use-claims";

type RescueCardProps = {
  rescue: FoodRescue;
  building: Building | undefined;
  event: CampusEvent | undefined; // the event this food is left over from
  now: number; // ms from the grid's shared clock
  holds: Pickup[]; // this student's open holds on this rescue
  takenCount: number; // open holds plus confirmed pickups, counted against the limit
  onClaim: (rescue: FoodRescue) => Promise<ClaimOutcome>;
};

// "Cesar Chavez Student Center, Rosa Parks A-C", or "Campus" with no building.
export function placeLabel(building: Building | undefined, room: string | null): string {
  const name = building?.name ?? "Campus";
  return room ? `${name}, ${room}` : name;
}

export function RescueCard({
  rescue,
  building,
  event,
  now,
  holds,
  takenCount,
  onClaim,
}: RescueCardProps) {
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
  const atLimit = takenCount >= rescue.maxPerPerson;
  const canClaim = !atLimit && left > 0;

  async function claim() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage(null);

    try {
      const outcome = await onClaim(rescue);
      setMessage(outcome.message);
      if (outcome.closed) setClosed(true);
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
          {event && (
            <p className="min-w-0 truncate text-muted-foreground">
              From{" "}
              <Link
                href={`/events/${event.id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {event.title}
              </Link>
            </p>
          )}
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
              className="h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{ transform: `scaleX(${percent / 100})` }}
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
          Dietary tags are AI estimates. Allergy? Ask the organizer before eating.
        </p>

        <div className="mt-auto space-y-2">
          {rescue.maxPerPerson > 1 && (
            <p className="text-xs text-muted-foreground">
              Up to {rescue.maxPerPerson} per student
            </p>
          )}
          {holds.length > 0 && (
            <ul className="space-y-1.5">
              {holds.map((hold) => (
                <li
                  key={hold.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-accent/15 p-2 ring-1 ring-accent/60"
                >
                  <PickupCode code={hold.code} size="sm" />
                  <p className="min-w-0 text-right text-xs">
                    <span className="block text-muted-foreground">Your code</span>
                    <HoldTimer until={hold.expiresAt} now={now} className="font-medium" />
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canClaim ? (
            <Button
              type="button"
              size="lg"
              className="h-10 w-full bg-accent text-accent-foreground hover:bg-accent/85 active:scale-[0.97]"
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
              ) : takenCount > 0 ? (
                "Claim another portion"
              ) : (
                "Claim a portion"
              )}
            </Button>
          ) : (
            holds.length === 0 && (
              <p className="flex h-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {atLimit ? "You reached the limit here" : "All portions are held"}
              </p>
            )
          )}
          {/* Always mounted so screen readers announce a message when it appears. */}
          <p
            role="status"
            aria-live="polite"
            className="text-pretty text-muted-foreground empty:hidden"
          >
            {message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
