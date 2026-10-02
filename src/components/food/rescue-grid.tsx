"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Check, TriangleAlert, Utensils } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCampus } from "@/lib/use-campus";
import { cn } from "@/lib/utils";
import { formatClock, useNow } from "./countdown";
import { placeLabel, RescueCard } from "./rescue-card";
import { useClaims } from "./use-claims";

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

function SkeletonCard() {
  const pulse = "motion-reduce:animate-none";
  return (
    <Card className="pt-0">
      <Skeleton className={cn("aspect-[4/3] w-full rounded-none", pulse)} />
      <CardContent className="flex flex-col gap-3">
        <Skeleton className={cn("h-5 w-3/4", pulse)} />
        <Skeleton className={cn("h-4 w-full", pulse)} />
        <Skeleton className={cn("h-4 w-1/2", pulse)} />
        <Skeleton className={cn("h-1.5 w-full rounded-full", pulse)} />
        <Skeleton className={cn("h-5 w-2/3", pulse)} />
        <Skeleton className={cn("h-10 w-full rounded-lg", pulse)} />
      </CardContent>
    </Card>
  );
}

export function RescueGrid() {
  const { buildings, rescues, loading, error } = useCampus();
  const now = useNow(1000);
  const { held, isHeld, hold } = useClaims();

  const buildingById = useMemo(
    () => new Map(buildings.map((building) => [building.id, building])),
    [buildings],
  );

  // Checked against the shared clock, so a rescue leaves the moment it runs
  // out or its time passes. A rescue this browser holds stays until its time.
  const visible = rescues.filter(
    (rescue) =>
      rescue.status === "open" &&
      Date.parse(rescue.safeUntil) > now &&
      (rescue.portionsLeft > 0 || isHeld(rescue.id)),
  );
  const openCount = visible.filter((rescue) => rescue.portionsLeft > 0).length;

  // Held claims whose rescue is no longer on screen as a card.
  const visibleIds = new Set(visible.map((rescue) => rescue.id));
  const pickups = loading
    ? []
    : held.filter((claim) => Date.parse(claim.safeUntil) > now && !visibleIds.has(claim.id));

  if (loading) {
    return (
      <div aria-busy="true" className={GRID}>
        <p className="sr-only" role="status">
          Loading free food
        </p>
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (error && rescues.length === 0) {
    return (
      <div className="space-y-6">
        <div
          role="alert"
          className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center"
        >
          <TriangleAlert aria-hidden="true" className="size-6 text-destructive" />
          <p className="text-base font-medium">Could not load free food.</p>
          <p className="text-sm text-pretty break-words text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pickups.length > 0 && (
        <section aria-labelledby="your-pickups" className="space-y-3">
          <h2 id="your-pickups" className="font-heading text-lg font-medium">
            Your pickups
          </h2>
          <ul className="space-y-2">
            {pickups.map((claim) => (
              <li
                key={claim.id}
                className="flex items-start gap-2.5 rounded-lg border border-accent/40 bg-accent/15 p-3 text-sm"
              >
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{claim.items}</p>
                  <p className="text-pretty break-words text-muted-foreground">
                    {placeLabel(buildingById.get(claim.buildingId), claim.room)}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums">before {formatClock(claim.safeUntil)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="min-w-0 text-pretty break-words">
            Could not refresh, so this list may be out of date. {error}
          </span>
        </p>
      )}

      <section aria-labelledby="open-food" className="space-y-3">
        <h2 id="open-food" className="sr-only">
          Open now
        </h2>
        <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
          {openCount} open right now
        </p>

        {visible.length > 0 ? (
          <ul className={GRID}>
            {visible.map((rescue) => (
              <li key={rescue.id} className="min-w-0">
                <RescueCard
                  rescue={rescue}
                  building={buildingById.get(rescue.buildingId)}
                  now={now}
                  held={isHeld(rescue.id)}
                  onClaimed={hold}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent/15">
              <Utensils aria-hidden="true" className="size-6" />
            </div>
            <p className="text-base font-medium">No free food right now</p>
            <p className="text-sm text-pretty text-muted-foreground">
              When a club posts leftovers they show up here right away.
            </p>
            <Link
              href="/post?tab=food"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
            >
              Post leftover food
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
