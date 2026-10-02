import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { Building, CampusEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type EventPhase, formatEventTime, placeLabel } from "./host-utils";

const countFormat = new Intl.NumberFormat();
const ACTION = "h-10 px-4";

export type DashboardRowProps = {
  event: CampusEvent;
  building: Building | undefined;
  phase: EventPhase;
};

export function DashboardRow({ event, building, phase }: DashboardRowProps) {
  return (
    <article className="flex flex-col gap-3 rounded-xl bg-card p-4 text-sm text-card-foreground ring-1 ring-foreground/10 lg:flex-row lg:items-center lg:gap-6">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="min-w-0 truncate text-base font-medium">{event.title}</h3>
          {phase === "now" && <Badge>Live</Badge>}
        </div>
        <p className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
          <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words tabular-nums">{formatEventTime(event)}</span>
        </p>
        <p className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words lg:line-clamp-1">
            {placeLabel(building, event.room)}
          </span>
        </p>
      </div>

      <p className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 tabular-nums">
        <span>
          <span className="font-medium">{countFormat.format(event.rsvpCount)}</span>{" "}
          <span className="text-muted-foreground">going</span>
        </span>
        <span>
          <span className="font-medium">{countFormat.format(event.checkedInCount)}</span>{" "}
          <span className="text-muted-foreground">checked in</span>
        </span>
      </p>

      {/* The title in each label tells screen reader users which event a link is for. */}
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          href={`/host/${event.id}/check-in`}
          aria-label={`Check in guests for ${event.title}`}
          className={cn(buttonVariants({ variant: phase === "past" ? "outline" : "default" }), ACTION)}
        >
          Check in
        </Link>
        <Link
          href={`/host/${event.id}`}
          aria-label={`Manage ${event.title}`}
          className={cn(buttonVariants({ variant: "outline" }), ACTION)}
        >
          Manage
        </Link>
        <Link
          href={`/events/${event.id}`}
          aria-label={`View the page for ${event.title}`}
          className={cn(buttonVariants({ variant: "ghost" }), ACTION)}
        >
          View page
        </Link>
      </div>
    </article>
  );
}
