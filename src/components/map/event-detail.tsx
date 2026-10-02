"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, Utensils, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";
import {
  countLabel,
  formatTime,
  formatTimeRange,
  isHappeningNow,
  placeLabel,
  type Selection,
} from "./map-utils";

type DetailPanelProps = {
  selection: Selection;
  buildings: Building[];
  events: CampusEvent[];
  allEvents: CampusEvent[]; // unfiltered, to name the event a rescue comes from
  rescues: FoodRescue[];
  now: number;
  onSelect: (selection: Selection) => void;
};

function Fact({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-sm">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

function EventDetail({ event, building, now }: { event: CampusEvent; building?: Building; now: number }) {
  const ended = Date.parse(event.endsAt) < now;

  return (
    <div className="space-y-4 p-5">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {isHappeningNow(event, now) && <Badge>Happening now</Badge>}
          {event.hasFood && <Badge className="bg-accent text-accent-foreground">Free food</Badge>}
        </div>
        <h2 className="text-lg leading-snug font-semibold tracking-tight text-balance break-words">
          {event.title}
        </h2>
      </div>

      <div className="space-y-2">
        <Fact icon={Users}>
          {event.clubId ? (
            <Link
              href={`/clubs/${event.clubId}`}
              className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {event.clubName}
            </Link>
          ) : (
            event.clubName
          )}
        </Fact>
        <Fact icon={Clock}>{formatTimeRange(event, now)}</Fact>
        <Fact icon={MapPin}>{placeLabel(building, event.room)}</Fact>
      </div>

      {event.hasFood && event.foodItems.length > 0 && (
        <ul aria-label="Food" className="flex flex-wrap gap-1.5">
          {event.foodItems.map((item) => (
            <li key={item}>
              <Badge className="bg-accent text-accent-foreground capitalize">
                <Utensils aria-hidden /> {item}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {event.description && (
        <p className="text-sm leading-relaxed text-muted-foreground break-words">
          {event.description}
        </p>
      )}

      {event.tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {event.tags.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary" className="capitalize">
                {tag}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <Link href={`/events/${event.id}`} className={cn(buttonVariants({ size: "lg" }), "flex-1")}>
          {ended ? "View event" : "View and register"}
        </Link>
        {event.rsvpCount > 0 && (
          <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {event.rsvpCount} going
          </p>
        )}
      </div>

      {event.flyerUrl && (
        // Flyers are user uploads on Supabase storage, so the size is not known ahead of time.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.flyerUrl}
          alt={`Flyer for ${event.title}`}
          width={600}
          height={800}
          loading="lazy"
          className="h-auto max-h-96 w-full rounded-lg border bg-muted object-contain"
        />
      )}
    </div>
  );
}

function RescueDetail({
  rescue,
  building,
  from,
}: {
  rescue: FoodRescue;
  building?: Building;
  from?: CampusEvent; // the event the food is left over from, when it is still listed
}) {
  return (
    <div className="space-y-4 p-5">
      <div className="space-y-2">
        <Badge className="bg-accent text-accent-foreground">
          <Utensils aria-hidden /> Free food
        </Badge>
        <h2 className="text-lg leading-snug font-semibold tracking-tight text-balance break-words">
          {rescue.items}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-accent/15 p-3">
          <p className="text-2xl font-semibold tabular-nums">{rescue.portionsLeft}</p>
          <p className="text-xs text-muted-foreground">
            of {countLabel(rescue.portions, "portion")} left
          </p>
        </div>
        <div className="rounded-lg bg-accent/15 p-3">
          <p className="text-2xl font-semibold tabular-nums">{formatTime(rescue.safeUntil)}</p>
          <p className="text-xs text-muted-foreground">safe until</p>
        </div>
      </div>

      <Fact icon={MapPin}>{placeLabel(building, rescue.room)}</Fact>

      {from && (
        <Fact icon={CalendarDays}>
          <Link
            href={`/events/${from.id}`}
            className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {from.title}
          </Link>
        </Fact>
      )}

      {rescue.dietary.length > 0 && (
        <ul aria-label="Dietary notes" className="flex flex-wrap gap-1.5">
          {rescue.dietary.map((note) => (
            <li key={note}>
              <Badge variant="outline" className="capitalize">
                {note}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {rescue.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rescue.photoUrl}
          alt={`Photo of ${rescue.items}`}
          width={600}
          height={400}
          loading="lazy"
          className="h-64 w-full rounded-lg border bg-muted object-cover"
        />
      )}

      <Link
        href="/food"
        className={cn(
          buttonVariants({ size: "lg" }),
          "w-full bg-accent text-accent-foreground hover:bg-accent/85",
        )}
      >
        Claim a portion
      </Link>
    </div>
  );
}

// Covers the list on a phone, and on a window too narrow to fit it beside the list.
// With room to spare it floats over the left edge of the map. The room is measured on the
// page (a container query), because the sidebar takes its share of the window.
export function DetailPanel({
  selection,
  buildings,
  events,
  allEvents,
  rescues,
  now,
  onSelect,
}: DetailPanelProps) {
  if (!selection) return null;

  const event = selection.kind === "event" ? events.find((item) => item.id === selection.id) : undefined;
  const rescue = selection.kind === "rescue" ? rescues.find((item) => item.id === selection.id) : undefined;
  const buildingId = event?.buildingId ?? rescue?.buildingId ?? selection.id;
  const building = buildings.find((item) => item.id === buildingId);
  const hereEvents = events.filter((item) => item.buildingId === buildingId);
  const hereRescues = rescues.filter((item) => item.buildingId === buildingId);
  const shared = hereEvents.length + hereRescues.length > 1;

  if (selection.kind !== "building" && !event && !rescue) return null;

  return (
    <section
      aria-label="Details"
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex h-[52%] flex-col border-t bg-background",
        "md:@max-5xl:inset-x-auto md:@max-5xl:inset-y-0 md:@max-5xl:left-0 md:@max-5xl:h-auto md:@max-5xl:w-96 md:@max-5xl:border-t-0 md:@max-5xl:border-r",
        "@5xl:inset-x-auto @5xl:top-4 @5xl:bottom-auto @5xl:left-[25rem] @5xl:h-auto @5xl:max-h-[calc(100%-2rem)] @5xl:w-96 @5xl:rounded-xl @5xl:border @5xl:shadow-xl",
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b py-2 pr-2 pl-3">
        {selection.kind !== "building" && shared ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0"
            onClick={() => onSelect({ kind: "building", id: buildingId })}
          >
            <ArrowLeft aria-hidden />
            <span className="truncate">All at {building?.name ?? "this building"}</span>
          </Button>
        ) : (
          <p className="min-w-0 truncate pl-2 text-sm font-medium text-muted-foreground">
            {selection.kind === "building" ? "At this building" : (building?.name ?? "On campus")}
          </p>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close details"
          className="ml-auto"
          onClick={() => onSelect(null)}
        >
          <X aria-hidden />
        </Button>
      </div>

      <div aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {event && <EventDetail event={event} building={building} now={now} />}
        {rescue && (
          <RescueDetail
            rescue={rescue}
            building={building}
            from={allEvents.find((item) => item.id === rescue.eventId)}
          />
        )}

        {selection.kind === "building" && (
          <div className="p-5">
            <h2 className="text-lg font-semibold tracking-tight text-balance">
              {building?.name ?? "On campus"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[
                hereEvents.length > 0 && countLabel(hereEvents.length, "event"),
                hereRescues.length > 0 && countLabel(hereRescues.length, "food rescue"),
              ]
                .filter(Boolean)
                .join(", ")}
            </p>

            <ul className="mt-4 space-y-2">
              {hereRescues.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect({ kind: "rescue", id: item.id })}
                    className="block w-full rounded-lg border border-accent/60 bg-accent/10 p-3 text-left transition-colors hover:bg-accent/20 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="block text-sm font-medium break-words">{item.items}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground tabular-nums">
                      {countLabel(item.portionsLeft, "portion")} left, safe until{" "}
                      {formatTime(item.safeUntil)}
                    </span>
                  </button>
                </li>
              ))}
              {hereEvents.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect({ kind: "event", id: item.id })}
                    className="block w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="block text-sm font-medium break-words">{item.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {formatTimeRange(item, now)}
                      {item.room ? `, ${item.room}` : ""}
                    </span>
                    {item.hasFood && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {item.foodItems.length === 0 && (
                          <Badge className="bg-accent text-accent-foreground">Free food</Badge>
                        )}
                        {item.foodItems.map((food) => (
                          <Badge key={food} className="bg-accent text-accent-foreground capitalize">
                            {food}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
