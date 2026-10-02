"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ticket, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/auth-provider";
import { countLabel } from "@/components/map/map-utils";
import { useNow } from "@/components/map/use-event-filters";
import { TicketCard, TicketCardSkeleton } from "@/components/tickets/ticket-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cancelRsvp, listBuildings, listMyTickets, rsvpEvent } from "@/lib/db";
import type { Building, TicketWithEvent } from "@/lib/types";

const POLL_MS = 10_000;

// "My tickets": upcoming tickets with their QR codes, then past ones.
export default function TicketsPage() {
  const user = useUser();
  const userId = user?.id ?? null;
  const now = useNow();

  const [tickets, setTickets] = useState<TicketWithEvent[] | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Bumped by every load and every cancel, so a slow response cannot overwrite newer data.
  const version = useRef(0);

  const load = useCallback(async () => {
    const mine = ++version.current;
    try {
      const [nextTickets, nextBuildings] = await Promise.all([listMyTickets(), listBuildings()]);
      if (mine !== version.current) return;
      setTickets(nextTickets);
      setBuildings(nextBuildings);
      setError(null);
    } catch (cause) {
      if (mine !== version.current) return;
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    }
  }, []);

  // Load once signed in, again when the tab comes back, and every 10 seconds while visible,
  // so a check-in at the door shows up without a manual refresh.
  useEffect(() => {
    if (!userId) return;
    // The first load is forced, so it runs even when the tab opens in the background.
    function refresh(force = false) {
      if (force || document.visibilityState === "visible") void load();
    }
    refresh(true);
    const onVisible = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(onVisible, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [userId, load]);

  function retry() {
    setError(null);
    void load();
  }

  async function cancel(ticket: TicketWithEvent) {
    const { eventId, event } = ticket;
    setCancellingId(ticket.id);
    try {
      await cancelRsvp(eventId);
      version.current++;
      setTickets((current) => current?.filter((item) => item.id !== ticket.id) ?? null);
      toast(`Registration cancelled: ${event.title}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await rsvpEvent(eventId);
              await load();
            } catch {
              toast.error("Could not register again. Try from the event page.");
            }
          },
        },
      });
    } catch {
      toast.error("Could not cancel. Try again.");
    } finally {
      setCancellingId(null);
    }
  }

  const upcoming: TicketWithEvent[] = [];
  const past: TicketWithEvent[] = [];
  for (const ticket of tickets ?? []) {
    (Date.parse(ticket.event.endsAt) > now ? upcoming : past).push(ticket);
  }
  upcoming.sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt));
  past.sort((a, b) => Date.parse(b.event.startsAt) - Date.parse(a.event.startsAt));

  const buildingById = new Map(buildings.map((building) => [building.id, building]));
  const loading = tickets === null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">My tickets</h1>
        <p role="status" className="text-sm text-muted-foreground tabular-nums">
          {tickets ? countLabel(tickets.length, "ticket") : error ? "Could not load" : "Loading…"}
        </p>
      </div>

      {loading && error ? (
        <div role="alert" className="mt-16 flex flex-col items-center gap-3 text-center">
          <TriangleAlert aria-hidden className="size-8 text-destructive" />
          <p className="font-medium">Could not load your tickets</p>
          <p className="text-sm break-words text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <div aria-hidden className="mt-6">
          <Skeleton className="h-5 w-20" />
          <div className="mt-3 space-y-4">
            <TicketCardSkeleton />
            <TicketCardSkeleton />
          </div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <Ticket aria-hidden className="size-8 text-muted-foreground" />
          <p className="font-medium">No tickets yet</p>
          <Link href="/map" className={buttonVariants()}>
            Find an event
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-heading" className="mt-6">
              <h2 id="upcoming-heading" className="text-sm font-semibold text-muted-foreground">
                Upcoming
              </h2>
              <ul className="mt-3 space-y-4">
                {upcoming.map((ticket) => (
                  <li key={ticket.id}>
                    <TicketCard
                      ticket={ticket}
                      building={buildingById.get(ticket.event.buildingId)}
                      now={now}
                      past={false}
                      cancelling={cancellingId === ticket.id}
                      onCancel={() => cancel(ticket)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section aria-labelledby="past-heading" className="mt-8">
              <h2 id="past-heading" className="text-sm font-semibold text-muted-foreground">
                Past
              </h2>
              <ul className="mt-3 space-y-2">
                {past.map((ticket) => (
                  <li key={ticket.id}>
                    <TicketCard
                      ticket={ticket}
                      building={buildingById.get(ticket.event.buildingId)}
                      now={now}
                      past
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
