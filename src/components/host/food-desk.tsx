"use client";

// Design reference (Mobbin, web): DoorDash Merchant "Orders" (one live list of pickups
// with status and a detail side) and Shopify "Scan to pick" for the verify step.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Plus, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/components/food/countdown";
import { listBuildings, listRescuesForEvent, releaseExpiredClaims } from "@/lib/db";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FoodPickups } from "./food-pickups";
import { FoodPostForm } from "./food-post-form";
import { GOLD_BUTTON } from "./food-utils";
import { HostGate } from "./host-states";
import { placeLabel } from "./host-utils";
import { useHostEvent } from "./use-host-event";

// Holds run out on their own, with no database change to listen for.
const POLL_MS = 15_000;

type RescuesState =
  | { status: "loading"; rescues: FoodRescue[] }
  | { status: "ready"; rescues: FoodRescue[] }
  | { status: "error"; rescues: FoodRescue[] };

async function fetchRescues(eventId: string): Promise<FoodRescue[]> {
  // Run-out holds go back on the list first, so "left" is right. Fine if it fails.
  await releaseExpiredClaims().catch(() => 0);
  return listRescuesForEvent(eventId);
}

function FoodDeskBody({ event, version }: { event: CampusEvent; version: number }) {
  const now = useNow(1000);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [state, setState] = useState<RescuesState>({ status: "loading", rescues: [] });
  const [posting, setPosting] = useState(false);
  const [polls, setPolls] = useState(0);
  // Bumped by a confirmed pickup, which changes no rescue row and so sends no live update.
  const [confirms, setConfirms] = useState(0);
  const tick = version + polls + confirms;

  useEffect(() => {
    let cancelled = false;
    listBuildings()
      .then((list) => {
        if (!cancelled) setBuildings(list);
      })
      .catch(() => {
        // The page still works without building names; the place reads "Campus".
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setPolls((current) => current + 1), POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  const apply = useCallback((load: Promise<FoodRescue[]>, isCancelled: () => boolean) => {
    load
      .then((rescues) => {
        if (!isCancelled()) setState({ status: "ready", rescues });
      })
      .catch(() => {
        if (isCancelled()) return;
        // Keep the last good list on screen if a background refresh fails.
        setState((current) =>
          current.status === "ready" ? current : { status: "error", rescues: [] },
        );
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    apply(fetchRescues(event.id), () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [apply, event.id, tick]);

  const place = placeLabel(
    buildings.find((building) => building.id === event.buildingId),
    event.room,
  );
  const { rescues } = state;
  const empty = state.status === "ready" && rescues.length === 0;

  function handlePublished(rescue: FoodRescue) {
    setPosting(false);
    // Show it right away. The live update brings the same row a moment later.
    setState((current) => ({
      status: "ready",
      rescues: [rescue, ...current.rescues.filter((item) => item.id !== rescue.id)],
    }));
    toast.success("Food posted", { description: "Students can hold a portion now." });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex min-w-0 flex-col gap-1">
        <Link
          href={`/host/${event.id}`}
          className="-ml-1 inline-flex min-h-10 w-fit touch-manipulation items-center gap-1.5 rounded-md px-1 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Manage event
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">Leftover food</h1>
          {!posting && rescues.length > 0 && (
            <Button
              className={cn(GOLD_BUTTON, "h-11 touch-manipulation px-4 text-base")}
              onClick={() => setPosting(true)}
            >
              <Plus aria-hidden />
              Post food
            </Button>
          )}
        </div>
        <p className="min-w-0 text-sm break-words text-muted-foreground">{event.title}</p>
        {!posting && (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">{place}</span>
          </p>
        )}
      </header>

      {posting && (
        <section
          aria-label="Post leftover food"
          className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none sm:p-5"
        >
          <FoodPostForm
            event={event}
            place={place}
            onPublished={handlePublished}
            onCancel={() => setPosting(false)}
          />
        </section>
      )}

      {state.status === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-3">
          <p role="status" className="sr-only">
            Loading food posts
          </p>
          <Skeleton className="h-20 w-full motion-reduce:animate-none" />
          <Skeleton className="h-56 w-full motion-reduce:animate-none" />
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
          <p className="text-base font-medium">Could not load the food posts</p>
          <Button
            variant="outline"
            className="h-11 touch-manipulation px-5 text-base"
            onClick={() => {
              setState({ status: "loading", rescues: [] });
              setPolls((current) => current + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {empty && !posting && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-accent/50 bg-accent/5 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent/20 text-accent-foreground">
            <Utensils aria-hidden className="size-6" />
          </span>
          <h2 className="text-lg font-semibold text-balance">No food posted yet</h2>
          <p className="max-w-xs text-sm text-pretty text-muted-foreground">
            One photo is enough. Students hold a portion and show you a code.
          </p>
          <Button
            className={cn(GOLD_BUTTON, "mt-1 h-12 touch-manipulation px-6 text-base")}
            onClick={() => setPosting(true)}
          >
            <Plus aria-hidden />
            Post leftover food
          </Button>
        </div>
      )}

      {rescues.map((rescue) => (
        <FoodPickups
          key={rescue.id}
          rescue={rescue}
          tick={tick}
          now={now}
          onConfirmed={() => setConfirms((current) => current + 1)}
        />
      ))}
    </div>
  );
}

export function FoodDesk({ id }: { id: string }) {
  const { status, event, error, version } = useHostEvent(id);

  return (
    <HostGate status={status} error={error}>
      {event && <FoodDeskBody event={event} version={version} />}
    </HostGate>
  );
}
