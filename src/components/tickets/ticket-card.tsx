"use client";

import Link from "next/link";
import { CalendarClock, CircleCheck, MapPin } from "lucide-react";
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
  "flex shrink-0 flex-col items-center justify-center border-t border-dashed p-5 sm:w-60 sm:border-t-0 sm:border-l";

// One ticket: event details on the left, the QR code (or the check-in state) on the right.
export function TicketCard({ ticket, building, now, past, cancelling, onCancel }: TicketCardProps) {
  const { event } = ticket;
  const checkedIn = ticket.checkedInAt !== null;
  const missed = past && !checkedIn;

  return (
    <Card className={cn(cardClass, missed && "bg-muted/50")}>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-3 p-5", missed && "opacity-70")}>
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-semibold text-balance break-words">
            <Link
              href={`/events/${event.id}`}
              className="rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {event.title}
            </Link>
          </h3>
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

        {event.hasFood && <Badge className="bg-accent text-accent-foreground">Free food</Badge>}

        {onCancel && !checkedIn && (
          <div className="mt-auto pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2.5 text-muted-foreground"
              disabled={cancelling}
              onClick={onCancel}
            >
              {cancelling ? "Cancelling…" : "Cancel registration"}
            </Button>
          </div>
        )}
      </div>

      <div className={stubClass}>
        {checkedIn && ticket.checkedInAt ? (
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <CircleCheck aria-hidden className="size-12 text-primary" />
            <p className="text-base font-semibold">Checked in</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              at {formatTime(ticket.checkedInAt)}
            </p>
            <p translate="no" className="mt-1 font-mono text-xs tracking-[0.3em] text-muted-foreground">
              {ticket.code}
            </p>
          </div>
        ) : missed ? (
          <p className="py-2 text-sm text-muted-foreground">Not checked in</p>
        ) : (
          <>
            {/* Phone: big enough to scan off the screen. Desktop: fits the stub. */}
            <TicketQr code={ticket.code} size={208} className="sm:hidden" />
            <TicketQr code={ticket.code} size={176} className="hidden sm:flex" />
          </>
        )}
      </div>
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
      </div>
      <div className={stubClass}>
        <Skeleton className="size-[200px] rounded-xl" />
      </div>
    </Card>
  );
}
