"use client";

// Mobbin reference: Sweatpals "You're in!" ticket confirmation (web) for the
// pickups, above a plain photo card grid.

import { useAuth, useRequireAccount } from "@/components/auth-provider";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, TriangleAlert, Utensils } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { claimPortion } from "@/lib/db";
import type { FoodRescue } from "@/lib/types";
import { useCampus } from "@/lib/use-campus";
import { cn } from "@/lib/utils";
import { useNow } from "./countdown";
import { ClaimedDialog, Pickups, type ClaimOutcome, type PickupRow } from "./pickups";
import { placeLabel, RescueCard } from "./rescue-card";
import {
  pickupState,
  useClaims,
  useEventLookup,
  useRescueLookup,
  type Pickup,
} from "./use-claims";

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

const EMPTY: Pickup[] = [];
const RECENT_PICKUP_MS = 12 * 60 * 60 * 1000;
const ORDER = { holding: 0, expired: 1, picked_up: 2 } as const;
const OFFLINE = "Could not claim. Check your connection and try again.";

type Claimed = { items: string; place: string; code: string; expiresAt: string };

function RetryButton({ onRetry }: { onRetry: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await onRetry();
        setPending(false);
      }}
    >
      {pending && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
      Try again
    </Button>
  );
}

export function RescueGrid() {
  const { buildings, events, rescues, loading: campusLoading, error } = useCampus();
  const now = useNow(1000);
  // Changes with every claim, release and new post, which refreshes the claims.
  const rescueKey = rescues
    .map((rescue) => `${rescue.id}:${rescue.portionsLeft}:${rescue.status}`)
    .join("|");
  const claims = useClaims(rescueKey);
  const [claimed, setClaimed] = useState<Claimed | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const buildingById = useMemo(
    () => new Map(buildings.map((building) => [building.id, building])),
    [buildings],
  );
  const rescueById = useRescueLookup(
    rescues,
    claims.pickups.map((pickup) => pickup.rescueId),
  );
  const eventById = useEventLookup(
    events,
    rescues.map((rescue) => rescue.eventId),
  );

  // Open holds and confirmed pickups per rescue. Both count against the limit.
  const holdsByRescue = new Map<string, Pickup[]>();
  const takenByRescue = new Map<string, number>();
  for (const pickup of claims.pickups) {
    const state = pickupState(pickup, now);
    if (state === "expired") continue;
    takenByRescue.set(pickup.rescueId, (takenByRescue.get(pickup.rescueId) ?? 0) + 1);
    if (state === "holding") {
      holdsByRescue.set(pickup.rescueId, [...(holdsByRescue.get(pickup.rescueId) ?? []), pickup]);
    }
  }

  // Checked against the shared clock, so a rescue leaves the moment it runs
  // out or its time passes. A rescue the student holds stays until its time.
  const open = rescues.filter(
    (rescue) =>
      rescue.status === "open" &&
      Date.parse(rescue.safeUntil) > now &&
      (rescue.portionsLeft > 0 || holdsByRescue.has(rescue.id)),
  );
  // The last claim marks a post "gone", which drops it from the live list. The
  // student holding one of those portions still sees it, first in the grid.
  const openIds = new Set(open.map((rescue) => rescue.id));
  const heldOnly = [...holdsByRescue.keys()]
    .filter((id) => !openIds.has(id))
    .map((id) => rescueById.get(id))
    .filter(
      (rescue): rescue is FoodRescue =>
        rescue !== undefined && Date.parse(rescue.safeUntil) > now,
    )
    // Off the live list means nothing is left to claim, whatever the last copy said.
    .map((rescue) => ({ ...rescue, portionsLeft: 0 }));
  const visible = [...heldOnly, ...open];
  const openCount = visible.filter((rescue) => rescue.portionsLeft > 0).length;
  const claimable = new Map(open.map((rescue) => [rescue.id, rescue]));

  const rows: PickupRow[] = claims.pickups
    .filter(
      (pickup) =>
        !pickup.pickedUpAt || now - Date.parse(pickup.pickedUpAt) < RECENT_PICKUP_MS,
    )
    .map((pickup) => {
      const live = claimable.get(pickup.rescueId);
      const rescue = live ?? rescueById.get(pickup.rescueId);
      return {
        pickup,
        rescue,
        place: rescue ? placeLabel(buildingById.get(rescue.buildingId), rescue.room) : "Campus",
        canClaimAgain:
          live !== undefined &&
          live.portionsLeft > 0 &&
          (takenByRescue.get(live.id) ?? 0) < live.maxPerPerson,
      };
    })
    .sort((a, b) => ORDER[pickupState(a.pickup, now)] - ORDER[pickupState(b.pickup, now)]);

  const requireAccount = useRequireAccount();
  const { ready: authReady } = useAuth();

  async function claim(rescue: FoodRescue): Promise<ClaimOutcome> {
    // A guest is sent to sign in first, then comes back to this page.
    if (!requireAccount()) return { ok: false, message: null, closed: false };
    try {
      const result = await claimPortion(rescue.id);
      if (result.ok && result.claimCode && result.expiresAt) {
        setClaimed({
          items: rescue.items,
          place: placeLabel(buildingById.get(rescue.buildingId), rescue.room),
          code: result.claimCode,
          expiresAt: result.expiresAt,
        });
        setDialogOpen(true);
        // The new hold replaces any expired one for the same food.
        claims.dismiss(
          claims.pickups
            .filter((p) => p.rescueId === rescue.id && pickupState(p, Date.now()) === "expired")
            .map((p) => p.id),
        );
        await claims.refresh();
        return { ok: true, message: null, closed: false };
      }
      switch (result.reason) {
        case "already_claimed":
          await claims.refresh();
          return { ok: false, message: "You reached the limit for this food.", closed: false };
        case "gone":
          return { ok: false, message: "All portions were just claimed.", closed: false };
        case "expired":
          return { ok: false, message: "This food is past its safe-until time.", closed: true };
        case "not_found":
          return { ok: false, message: "This post was removed.", closed: true };
        case "not_signed_in":
          return {
            ok: false,
            message: "Still connecting you. Try again in a moment.",
            closed: false,
          };
        default:
          return { ok: false, message: OFFLINE, closed: false };
      }
    } catch {
      return { ok: false, message: OFFLINE, closed: false };
    }
  }

  // Also waits for the profile: before it loads a signed-in student still looks like a
  // guest, and Claim would send them to the onboarding.
  const loading = campusLoading || claims.loading || !authReady;

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
      {(rows.length > 0 || claims.notices.length > 0 || claims.error) && (
        <section aria-labelledby="your-pickups" className="space-y-3">
          <h2 id="your-pickups" className="font-heading text-lg font-medium">
            Your pickups
          </h2>
          {claims.error && (
            <p
              role="alert"
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
            >
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-destructive" />
              <span className="min-w-0 flex-1 text-pretty break-words">
                Could not load your pickups.
              </span>
              <RetryButton onRetry={claims.refresh} />
            </p>
          )}
          {(rows.length > 0 || claims.notices.length > 0) && (
            <Pickups
              rows={rows}
              notices={claims.notices}
              now={now}
              onClaim={claim}
              onDismiss={claims.dismiss}
              onDismissNotice={claims.dismissNotice}
            />
          )}
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
                  event={rescue.eventId ? eventById.get(rescue.eventId) : undefined}
                  holds={holdsByRescue.get(rescue.id) ?? EMPTY}
                  takenCount={takenByRescue.get(rescue.id) ?? 0}
                  onClaim={claim}
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
              Leftovers show up here the moment a club posts them.
            </p>
            <Link
              href="/host"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
            >
              Post leftover food
            </Link>
          </div>
        )}
      </section>

      <ClaimedDialog
        open={dialogOpen}
        claimed={claimed}
        now={now}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
