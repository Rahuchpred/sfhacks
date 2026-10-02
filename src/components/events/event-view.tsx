// Mobbin reference: Sweatpals event page (web), cover beside the details with a "Meet your host" block.
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarPlus, Link2, MapPin, Utensils } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/auth-provider";
import { mainCategory } from "@/components/map/categories";
import { formatTime, isHappeningNow, placeLabel } from "@/components/map/map-utils";
import { useNow } from "@/components/map/use-event-filters";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getEvent,
  getMyTicket,
  listBuildings,
  listOpenRescues,
  subscribeToCampus,
} from "@/lib/db";
import type { Building, CampusEvent, Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EventCover } from "./event-cover";
import { WhenLine } from "./event-tile";
import { downloadIcs } from "./ics";
import { RegistrationCard } from "./registration-card";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; event: CampusEvent | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-10">
      <Link
        href="/map"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-5 -ml-2 text-muted-foreground",
        )}
      >
        <ArrowLeft aria-hidden />
        Back to map
      </Link>
      {children}
    </div>
  );
}

const columns = "grid gap-8 md:grid-cols-[20rem_minmax(0,1fr)] md:gap-10";
const sideHeading = "border-b pb-2 text-sm font-medium text-muted-foreground";
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short" });
const dateFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });
const coverColumn = "mx-auto w-full max-w-sm space-y-6 md:mx-0 md:max-w-none";

function LoadingSkeleton() {
  const pulse = "motion-reduce:animate-none";
  return (
    <div className={columns} role="status" aria-label="Loading…">
      <div className={coverColumn}>
        {/* The shape of the generated cover, so the page does not jump when the event arrives. */}
        <Skeleton className={cn("aspect-video w-full rounded-xl md:aspect-square", pulse)} />
        <Skeleton className={cn("h-4 w-40", pulse)} />
      </div>
      <div className="space-y-5">
        <Skeleton className={cn("h-9 w-4/5", pulse)} />
        <Skeleton className={cn("h-4 w-64 max-w-full", pulse)} />
        <Skeleton className={cn("h-4 w-52 max-w-full", pulse)} />
        <Skeleton className={cn("h-32 w-full rounded-xl", pulse)} />
        <Skeleton className={cn("h-20 w-full", pulse)} />
      </div>
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
      {children}
    </div>
  );
}

// The event page body. Remount with a key when the id changes.
export function EventView({ id }: { id: string }) {
  const user = useUser();
  const userId = user?.id ?? null;
  const now = useNow();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketReady, setTicketReady] = useState(false);
  // Portions of leftover food from this event that can still be claimed.
  const [leftoverPortions, setLeftoverPortions] = useState(0);

  // Set by the effect below so click handlers can ask for a fresh copy.
  const reloadEvent = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    // An id that is not a UUID can never match a row, and the database rejects it.
    const valid = UUID.test(id);

    function loadEvent() {
      (valid ? getEvent(id) : Promise.resolve(null)).then(
        (event) => {
          if (active) setState({ status: "ready", event });
        },
        () => {
          // A failed live refresh keeps the page that is already showing.
          if (active) {
            setState((current) => (current.status === "ready" ? current : { status: "error" }));
          }
        },
      );
    }

    function loadTicket() {
      if (!userId || !valid) return;
      getMyTicket(id)
        .then(
          (next) => {
            if (active) setTicket(next);
          },
          () => {
            // Keep the last known ticket. Register still works without the lookup.
          },
        )
        .finally(() => {
          if (active) setTicketReady(true);
        });
    }

    function loadLeftovers() {
      if (!valid) return;
      listOpenRescues().then(
        (rescues) => {
          if (!active) return;
          const left = rescues
            .filter((rescue) => rescue.eventId === id)
            .reduce((sum, rescue) => sum + rescue.portionsLeft, 0);
          setLeftoverPortions(left);
        },
        () => {
          // The note is a bonus. The food page still lists everything.
        },
      );
    }

    // Check-in updates the event row, so one signal refreshes the count and the ticket.
    function reload() {
      loadEvent();
      loadTicket();
      loadLeftovers();
    }

    reloadEvent.current = loadEvent;
    reload();
    const unsubscribe = subscribeToCampus(reload);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id, userId]);

  useEffect(() => {
    let active = true;
    listBuildings().then(
      (list) => {
        if (active) setBuildings(list);
      },
      () => {
        // The place row falls back to "On campus".
      },
    );
    return () => {
      active = false;
    };
  }, []);

  function retry() {
    setState({ status: "loading" });
    reloadEvent.current();
  }

  function onTicketChange(next: Ticket | null) {
    setTicket(next);
    reloadEvent.current();
  }

  if (state.status === "loading") {
    return (
      <Shell>
        <LoadingSkeleton />
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell>
        <Message title="Could not load this event">
          <Button onClick={retry}>Try again</Button>
        </Message>
      </Shell>
    );
  }

  const event = state.event;
  if (!event) {
    return (
      <Shell>
        <Message title="This event does not exist or was removed">
          <Link href="/map" className={buttonVariants()}>
            See what is on campus
          </Link>
        </Message>
      </Shell>
    );
  }

  const building = buildings.find((item) => item.id === event.buildingId);
  const place = placeLabel(building, event.room);
  const ended = Date.parse(event.endsAt) < now;
  const live = isHappeningNow(event, now);
  const category = mainCategory(event);

  function addToCalendar() {
    if (!event) return;
    downloadIcs({
      id: event.id,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: `${place}, San Francisco State University`,
      url: window.location.href,
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <Shell>
      <article className={columns}>
        <div className={coverColumn}>
          <EventCover event={event} />

          <section aria-labelledby="host-heading" className="min-w-0">
            <h2 id="host-heading" className={sideHeading}>
              Hosted by
            </h2>
            <p className="mt-3 flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground uppercase"
              >
                {event.clubName.trim().charAt(0) || "?"}
              </span>
              {event.clubId ? (
                <Link
                  href={`/clubs/${event.clubId}`}
                  className="min-w-0 rounded-sm text-sm font-medium break-words underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {event.clubName}
                </Link>
              ) : (
                <span className="min-w-0 text-sm font-medium break-words">{event.clubName}</span>
              )}
            </p>
          </section>

          {event.rsvpCount > 0 && (
            <section aria-labelledby="going-heading" className="hidden md:block">
              <h2 id="going-heading" className={sideHeading}>
                <span className="tabular-nums">{event.rsvpCount}</span> going
              </h2>
              {event.checkedInCount > 0 && (
                <p className="mt-3 text-sm text-muted-foreground tabular-nums">
                  {event.checkedInCount} checked in at the door
                </p>
              )}
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            {live && <WhenLine event={event} now={now} className="text-sm" />}
            <ul aria-label="Highlights" className="flex flex-wrap gap-1.5">
              <li>
                <Badge className={category.tint}>
                  <category.icon aria-hidden /> {category.label}
                </Badge>
              </li>
              {event.hasFood && (
                <li>
                  <Badge className="bg-accent text-accent-foreground">Free food</Badge>
                </li>
              )}
              {event.hasFood &&
                event.foodItems.map((item) => (
                  <li key={item}>
                    <Badge
                      variant="outline"
                      className="border-accent/50 bg-accent/10 capitalize"
                    >
                      {item}
                    </Badge>
                  </li>
                ))}
            </ul>
            <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance break-words md:text-4xl">
              {event.title}
            </h1>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                aria-hidden
                className={cn(
                  "flex size-10 shrink-0 flex-col justify-center rounded-lg text-center",
                  category.tint,
                )}
              >
                <span className="text-[0.625rem] leading-3 font-semibold tracking-wide uppercase opacity-80">
                  {monthFormat.format(new Date(event.startsAt))}
                </span>
                <span className="text-base leading-5 font-semibold tabular-nums">
                  {new Date(event.startsAt).getDate()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-medium">{dateFormat.format(new Date(event.startsAt))}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {formatTime(event.startsAt)} to {formatTime(event.endsAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-lg border"
              >
                <MapPin className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-medium break-words">{building?.name ?? "On campus"}</p>
                <p className="text-sm break-words text-muted-foreground">
                  {event.room ? `${event.room}, SF State` : "San Francisco State University"}
                </p>
              </div>
            </div>
          </div>

          {leftoverPortions > 0 && (
            <Link
              href="/food"
              className="group flex items-center gap-2.5 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent/20 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Utensils aria-hidden className="size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 tabular-nums">
                Leftover food: {leftoverPortions} {leftoverPortions === 1 ? "portion" : "portions"}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                Claim
                <ArrowRight
                  aria-hidden
                  className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </span>
            </Link>
          )}

          <RegistrationCard
            eventId={event.id}
            ticket={ticket}
            ready={ticketReady}
            ended={ended}
            going={event.rsvpCount}
            onTicketChange={onTicketChange}
          />

          <div className="flex flex-wrap gap-2">
            {!ended && (
              <Button variant="outline" onClick={addToCalendar}>
                <CalendarPlus aria-hidden />
                Add to calendar
              </Button>
            )}
            <Button variant="outline" onClick={copyLink}>
              <Link2 aria-hidden />
              Copy link
            </Button>
          </div>

          {(event.description || event.tags.length > 0) && (
            <section aria-labelledby="about-heading" className="space-y-3">
              <h2 id="about-heading" className={sideHeading}>
                About this event
              </h2>
              {event.description && (
                <p className="text-sm leading-relaxed break-words whitespace-pre-line text-muted-foreground">
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
            </section>
          )}
        </div>
      </article>
    </Shell>
  );
}
