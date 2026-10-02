// Mobbin reference: GetYourGuide bookings (web), a status line per ticket and a quieter "Past" group.
"use client";

import Link from "next/link";
import { CalendarClock, CircleCheck, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime, formatTimeRange, placeLabel } from "@/components/map/map-utils";
import { cn } from "@/lib/utils";
import type { Building, TicketWithEvent } from "@/lib/types";
import { TicketQr } from "./ticket-qr";

type TicketCardProps = {
  ticket: TicketWithEvent;
  building: Building | undefined;
  now: number;
  past: boolean;
  cancelling?: boolean;
  onCancel?: () => void;
};

const cardClass = "gap-0 py-0 sm:flex-row";
// The tear line between the details and the stub: under the details on a phone, beside them on desktop.
const stubClass =
  "flex shrink-0 flex-col items-center justify-center border-t border-dashed p-5 sm:w-64 sm:border-t-0 sm:border-l";

// One ticket: event details on the left, the QR code (or the check-in state) on the right.
// Three looks: upcoming (QR), checked in (solid purple stub), and missed (a quiet single row).
export function TicketCard({ ticket, building, now, past, cancelling, onCancel }: TicketCardProps) {
  const { event } = ticket;
  const checkedIn = ticket.checkedInAt !== null;
  const missed = past && !checkedIn;

  const title = (
    <Link
      href={`/events/${event.id}`}
      className="rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {event.title}
    </Link>
  );

  if (missed) {
    return (
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border border-dashed px-5 py-3 text-muted-foreground">
        <div className="min-w-0">
          <h3 className="text-sm font-medium break-words">{title}</h3>
          <p className="text-xs break-words tabular-nums">
            {formatTimeRange(event, now)}, {placeLabel(building, event.room)}
          </p>
        </div>
        <p className="shrink-0 text-xs">Not checked in</p>
      </div>
    );
  }

  return (
    <Card className={cn(cardClass, "overflow-hidden", checkedIn && "ring-primary/40")}>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-semibold text-balance break-words">{title}</h3>
          <p className="mt-0.5 text-sm break-words text-muted-foreground">{event.clubName}</p>
        </div>

        <dl className="space-y-1.5 text-sm">
          <div className="flex items-start gap-2">
            <dt>
              <CalendarClock aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
              <span className="sr-only">When</span>
            </dt>
            <dd className="min-w-0 tabular-nums">{formatTimeRange(event, now)}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt>
              <MapPin aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
              <span className="sr-only">Where</span>
            </dt>
            <dd className="min-w-0 break-words">{placeLabel(building, event.room)}</dd>
          </div>
        </dl>

        {event.hasFood && !past && (
          <Badge className="bg-accent text-accent-foreground">Free food</Badge>
        )}

        {onCancel && !checkedIn && (
          <div className="mt-auto pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2.5 text-muted-foreground"
              disabled={cancelling}
              onClick={onCancel}
            >
              {cancelling && (
                <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
              )}
              {cancelling ? "Cancelling…" : "Cancel registration"}
            </Button>
          </div>
        )}
      </div>

      {checkedIn && ticket.checkedInAt ? (
        <div
          className={cn(
            stubClass,
            "gap-1 border-primary bg-primary py-6 text-center text-primary-foreground",
          )}
        >
          <CircleCheck aria-hidden className="size-10" />
          <p className="text-base font-semibold">Checked in</p>
          <p className="text-sm text-primary-foreground/80 tabular-nums">
            {formatTime(ticket.checkedInAt)}
          </p>
        </div>
      ) : (
        <div className={stubClass}>
          {/* Phone: 256px, so a door scanner reads it at arm's length. Desktop: fits the stub. */}
          <TicketQr code={ticket.code} size={256} className="sm:hidden" />
          <TicketQr code={ticket.code} size={192} className="hidden sm:flex" />
        </div>
      )}
    </Card>
  );
}

export function TicketCardSkeleton() {
  return (
    <Card className={cardClass}>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-auto h-7 w-36" />
      </div>
      <div className={stubClass}>
        {/* The QR box and the code under it, at the sizes the ticket uses. */}
        <Skeleton className="aspect-square w-full max-w-[282px] rounded-xl sm:w-[218px]" />
        <Skeleton className="mt-3 h-7 w-36" />
      </div>
    </Card>
  );
}
