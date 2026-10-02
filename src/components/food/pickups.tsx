"use client";

// Mobbin reference: Sweatpals "You're in!" ticket confirmation (web), a ticket
// card with the event, place and one primary action. The countdown follows the
// GetYourGuide "Deals expire in" timer.

import { useRef, useState } from "react";
import { Check, Clock, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FoodRescue } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatClock, HoldTimer } from "./countdown";
import { PickupCode } from "./pickup-code";
import { pickupState, type Pickup } from "./use-claims";

export type ClaimOutcome = { ok: boolean; message: string | null; closed: boolean };

export type PickupRow = {
  pickup: Pickup;
  rescue: FoodRescue | undefined;
  place: string;
  canClaimAgain: boolean; // portions remain and the student is under the limit
};

const TILE =
  "flex min-w-0 flex-col gap-3 rounded-xl p-4 text-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none";

function Place({ place }: { place: string }) {
  return (
    <p className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
      <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 text-pretty break-words">{place}</span>
    </p>
  );
}

function ExpiredTile({
  row,
  onClaim,
  onDismiss,
}: {
  row: PickupRow;
  onClaim: (rescue: FoodRescue) => Promise<ClaimOutcome>;
  onDismiss: (ids: string[]) => void;
}) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const { pickup, rescue, canClaimAgain } = row;

  async function claimAgain() {
    if (!rescue || busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const outcome = await onClaim(rescue);
      if (!outcome.ok && outcome.message) toast.error(outcome.message);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <li className={cn(TILE, "bg-card ring-1 ring-foreground/10")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-destructive">Hold expired</p>
          <p className="truncate text-muted-foreground">{rescue?.items ?? "Free food"}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-mt-1 -mr-1"
          onClick={() => onDismiss([pickup.id])}
        >
          <X aria-hidden="true" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
      <PickupCode code={pickup.code} size="sm" muted />
      <p className="text-muted-foreground">
        Not picked up by {formatClock(pickup.expiresAt)}, so the portion went back on the list.
      </p>
      {canClaimAgain ? (
        <Button
          type="button"
          size="lg"
          className="mt-auto w-full bg-accent text-accent-foreground hover:bg-accent/85 active:scale-[0.97]"
          disabled={pending}
          onClick={claimAgain}
        >
          {pending ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
              Claiming…
            </>
          ) : (
            "Claim again"
          )}
        </Button>
      ) : (
        <p className="mt-auto font-medium">No portions left</p>
      )}
    </li>
  );
}

export function Pickups({
  rows,
  now,
  onClaim,
  onDismiss,
}: {
  rows: PickupRow[];
  now: number;
  onClaim: (rescue: FoodRescue) => Promise<ClaimOutcome>;
  onDismiss: (ids: string[]) => void;
}) {
  return (
    <ul className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const { pickup, rescue, place } = row;
        const state = pickupState(pickup, now);

        if (state === "expired") {
          return <ExpiredTile key={pickup.id} row={row} onClaim={onClaim} onDismiss={onDismiss} />;
        }

        if (state === "picked_up") {
          return (
            <li key={pickup.id} className={cn(TILE, "bg-card ring-1 ring-foreground/10")}>
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/25">
                  <Check aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">
                    Picked up {pickup.pickedUpAt ? formatClock(pickup.pickedUpAt) : ""}
                  </p>
                  <p className="truncate text-muted-foreground">{rescue?.items ?? "Free food"}</p>
                </div>
              </div>
            </li>
          );
        }

        return (
          <li key={pickup.id} className={cn(TILE, "bg-accent/15 ring-1 ring-accent/60")}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate font-medium">{rescue?.items ?? "Free food"}</p>
              <p className="flex shrink-0 items-center gap-1 font-medium">
                <Clock aria-hidden="true" className="size-3.5" />
                <HoldTimer until={pickup.expiresAt} now={now} />
              </p>
            </div>
            <PickupCode code={pickup.code} />
            <p className="font-medium">Show this code to the organizer</p>
            <Place place={place} />
          </li>
        );
      })}
    </ul>
  );
}

// Opens right after a claim, with the code as large as it gets.
export function ClaimedDialog({
  open,
  claimed,
  now,
  onClose,
}: {
  open: boolean;
  // Kept after closing, so the content stays put while the dialog fades out.
  claimed: { items: string; place: string; code: string; expiresAt: string } | null;
  now: number;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open && claimed !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {claimed && (
        <DialogContent className="justify-items-center gap-5 p-6 text-center">
          <DialogHeader className="items-center">
            <DialogTitle>Portion held</DialogTitle>
            <DialogDescription className="text-pretty break-words">
              {claimed.items}
            </DialogDescription>
          </DialogHeader>
          <PickupCode code={claimed.code} size="lg" />
          <p className="text-base font-medium">Show this code to the organizer</p>
          <div className="space-y-1">
            <p className="flex items-start justify-center gap-1.5 text-muted-foreground">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 text-pretty break-words">{claimed.place}</span>
            </p>
            <p className="font-medium">
              <HoldTimer until={claimed.expiresAt} now={now} />
            </p>
          </div>
          <DialogClose render={<Button size="lg" className="w-full" />}>Got it</DialogClose>
        </DialogContent>
      )}
    </Dialog>
  );
}
