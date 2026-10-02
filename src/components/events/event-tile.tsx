"use client";

// The Mobbin tool was not available in this round, so these follow well known event lists
// from memory: Luma discover (web), a small square cover on every row with the start time
// set above the title, Resident Advisor listings (web), a date block that leads the row,
// and Partiful (web), a pulsing "live" dot with the time left.

import { useState } from "react";
import { Users, Utensils, type LucideIcon } from "lucide-react";
import { mainCategory } from "@/components/map/categories";
import {
  dayLabel,
  durationLabel,
  formatTime,
  isHappeningNow,
  liveProgress,
} from "@/components/map/map-utils";
import type { CampusEvent, FoodRescue } from "@/lib/types";
import { cn } from "@/lib/utils";

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short" });
const SOON_MS = 60 * 60_000;

const tileSizes = {
  row: { box: "size-12 rounded-xl", icon: "size-5", day: "text-lg leading-5", month: "text-[0.625rem]" },
  lg: { box: "size-14 rounded-xl", icon: "size-6", day: "text-xl leading-6", month: "text-[0.6875rem]" },
};

type TileSize = keyof typeof tileSizes;

// A user upload that may fail to load. The tile behind it shows through when it does.
function Photo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // Uploads on Supabase storage, so the size is not known ahead of time.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="absolute inset-0 size-full rounded-[inherit] object-cover"
    />
  );
}

// The pin of the row, in small: the same circle and icon the map shows.
function PinBadge({ icon: Icon, tone }: { icon: LucideIcon; tone: "event" | "food" }) {
  return (
    <span
      className={cn(
        "absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-background",
        tone === "food" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground",
      )}
    >
      <Icon className="size-3" />
    </span>
  );
}

type EventTileProps = {
  event: Pick<CampusEvent, "title" | "tags" | "flyerUrl" | "startsAt" | "endsAt">;
  now: number;
  size?: TileSize;
  className?: string;
};

// The square that leads an event everywhere it is listed. It is the flyer when there is
// one. Without a flyer it is a tile in the category colour: the category icon for today,
// the date for a later day. A live event shows how far along it is on the bottom edge.
export function EventTile({ event, now, size = "row", className }: EventTileProps) {
  const category = mainCategory(event);
  const Icon = category.icon;
  const sizes = tileSizes[size];
  const later = dayLabel(event.startsAt, now) !== "Today";
  const live = isHappeningNow(event, now);
  const starts = new Date(event.startsAt);

  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 flex-col items-center justify-center",
        sizes.box,
        category.tint,
        className,
      )}
    >
      {later ? (
        <>
          <span className={cn("font-semibold tracking-wide uppercase opacity-80", sizes.month)}>
            {monthFormat.format(starts)}
          </span>
          <span className={cn("font-semibold tabular-nums", sizes.day)}>{starts.getDate()}</span>
        </>
      ) : (
        <Icon className={cn(sizes.icon, live && "-translate-y-1")} />
      )}
      {event.flyerUrl && <Photo src={event.flyerUrl} alt="" />}
      {live && (
        <span className="absolute inset-x-1.5 bottom-1.5 h-1 overflow-hidden rounded-full bg-background/80">
          <span
            className="block h-full origin-left rounded-full bg-rose-600 transition-transform duration-500 ease-linear motion-reduce:transition-none"
            style={{ transform: `scaleX(${liveProgress(event, now)})` }}
          />
        </span>
      )}
      {(later || event.flyerUrl) && <PinBadge icon={Icon} tone="event" />}
    </span>
  );
}

// The food photo, with the gold food pin on its corner.
export function RescueTile({
  rescue,
  size = "row",
  className,
}: {
  rescue: Pick<FoodRescue, "photoUrl">;
  size?: TileSize;
  className?: string;
}) {
  const sizes = tileSizes[size];
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center bg-accent/25 text-accent-foreground",
        sizes.box,
        className,
      )}
    >
      <Utensils className={sizes.icon} />
      {rescue.photoUrl && (
        <>
          <Photo src={rescue.photoUrl} alt="" />
          <PinBadge icon={Utensils} tone="food" />
        </>
      )}
    </span>
  );
}

// Red is the usual colour of "live". The ring pulses, the dot itself never moves.
export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative flex size-2 shrink-0", className)}>
      <span className="absolute inset-0 rounded-full bg-rose-500 opacity-75 motion-safe:animate-ping" />
      <span className="relative size-2 rounded-full bg-rose-600" />
    </span>
  );
}

// The time as the first line of an event: "Live, 45 min left" while it runs, the start
// time in bold before it starts, with "in 20 min" once it is under an hour away.
export function WhenLine({
  event,
  now,
  className,
}: {
  event: Pick<CampusEvent, "startsAt" | "endsAt">;
  now: number;
  className?: string;
}) {
  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  const line = cn("flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums", className);

  if (isHappeningNow(event, now)) {
    return (
      <span className={line}>
        <LiveDot />
        <span className="font-semibold text-rose-700">Live</span>
        <span className="text-muted-foreground">{durationLabel(end - now)} left</span>
      </span>
    );
  }

  const soon = start > now && start - now <= SOON_MS;
  return (
    <span className={line}>
      <span className="font-semibold">{formatTime(event.startsAt)}</span>
      {soon ? (
        <span className="font-medium text-primary">in {durationLabel(start - now)}</span>
      ) : (
        end >= now && <span className="text-muted-foreground">to {formatTime(event.endsAt)}</span>
      )}
    </span>
  );
}

// How many registered, and once the doors are open how many showed up. Nothing at zero.
export function GoingCount({
  event,
  live = false,
  className,
}: {
  event: Pick<CampusEvent, "rsvpCount" | "checkedInCount">;
  live?: boolean;
  className?: string;
}) {
  if (event.rsvpCount <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 text-xs font-medium tabular-nums",
        className,
      )}
    >
      <Users aria-hidden className="size-3.5 text-muted-foreground" />
      {event.rsvpCount} going
      {live && event.checkedInCount > 0 && (
        <span className="font-normal text-muted-foreground">{event.checkedInCount} here</span>
      )}
    </span>
  );
}
