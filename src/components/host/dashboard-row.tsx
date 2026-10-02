import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, ScanLine, Users, Utensils } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Building, CampusEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type EventPhase, formatClock, formatStamp, placeLabel } from "./host-utils";

const countFormat = new Intl.NumberFormat();
const ACTION = "h-9 px-3";
const THUMB = "size-18 shrink-0 rounded-lg sm:size-30";

export type DashboardRowProps = {
  event: CampusEvent;
  building: Building | undefined;
  phase: EventPhase;
  // Set when the list around the row does not already make the club plain.
  clubLabel?: string;
  // True once the start time has passed: leftover food can be posted from then on.
  started?: boolean;
  // False for a club member, who sees the guest list but cannot edit the event.
  canManage?: boolean;
};

// "7:00 PM", or "Oct 9, 7:00 PM" when the event ends on another day.
function endLabel(event: CampusEvent): string {
  const sameDay = new Date(event.startsAt).toDateString() === new Date(event.endsAt).toDateString();
  return sameDay ? formatClock(event.endsAt) : formatStamp(event.endsAt);
}

export function DashboardRow({
  event,
  building,
  phase,
  clubLabel,
  started,
  canManage = true,
}: DashboardRowProps) {
  const live = phase === "now";
  const start = formatClock(event.startsAt);
  const end = endLabel(event);

  return (
    <article
      className={cn(
        "flex items-start gap-4 rounded-xl bg-card p-4 text-sm text-card-foreground ring-1 ring-foreground/10",
        live && "shadow-md",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-muted-foreground tabular-nums">
          {live && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
              />
              LIVE
            </span>
          )}
          <span className="min-w-0 break-words">
            {live ? `${start} until ${end}` : `${start} to ${end}`}
          </span>
          {clubLabel && (
            <span className="max-w-full truncate rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {clubLabel}
            </span>
          )}
        </p>

        <h3 className="line-clamp-2 min-w-0 text-lg leading-snug font-medium break-words">
          {event.title}
        </h3>

        <p className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="line-clamp-2 min-w-0 break-words">
            {placeLabel(building, event.room)}
          </span>
        </p>
        <p className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
          <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 tabular-nums">
            {countFormat.format(event.rsvpCount)} going · {countFormat.format(event.checkedInCount)}{" "}
            checked in
          </span>
        </p>

        {/* The title in each label tells screen reader users which event a link is for. */}
        <div className="flex flex-wrap gap-2 pt-1.5">
          <Link
            href={`/host/${event.id}/check-in`}
            aria-label={`Check in guests for ${event.title}`}
            className={cn(
              buttonVariants({ variant: phase === "past" ? "outline" : "default" }),
              ACTION,
            )}
          >
            <ScanLine aria-hidden="true" />
            Check in
          </Link>
          <Link
            href={`/host/${event.id}`}
            aria-label={`${canManage ? "Manage" : "Guest list for"} ${event.title}`}
            className={cn(buttonVariants({ variant: "outline" }), ACTION)}
          >
            {canManage ? "Manage" : "Guest list"}
            <ArrowRight aria-hidden="true" />
          </Link>
          {started && event.hasFood && (
            <Link
              href={`/host/${event.id}/food`}
              aria-label={`Post leftover food from ${event.title}`}
              className={cn(
                buttonVariants(),
                ACTION,
                "bg-accent text-accent-foreground hover:bg-accent/80",
              )}
            >
              <Utensils aria-hidden="true" />
              Leftover food
            </Link>
          )}
          <Link
            href={`/events/${event.id}`}
            aria-label={`View the page for ${event.title}`}
            className={cn(buttonVariants({ variant: "ghost" }), ACTION)}
          >
            View page
          </Link>
        </div>
      </div>

      {event.flyerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.flyerUrl}
          alt=""
          width={120}
          height={120}
          loading="lazy"
          className={cn(THUMB, "bg-muted object-cover")}
        />
      ) : (
        <div aria-hidden="true" className={cn(THUMB, "flex items-center justify-center bg-primary/10")}>
          <CalendarDays className="size-6 text-primary sm:size-8" />
        </div>
      )}
    </article>
  );
}
