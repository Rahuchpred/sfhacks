"use client";

import { useRequireAccount } from "@/components/auth-provider";
import { useId, useState } from "react";
import Link from "next/link";
import { CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TicketQr } from "@/components/tickets/ticket-qr";
import { formatTime } from "@/components/map/map-utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelRsvp, getMyProfile, rsvpEvent, saveMyProfile } from "@/lib/db";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";

export type RegistrationCardProps = {
  eventId: string;
  ticket: Ticket | null;
  // False until the anonymous session exists and the ticket lookup has finished.
  ready: boolean;
  ended: boolean;
  going: number;
  // Called with the new ticket after registering, or null after cancelling.
  onTicketChange: (ticket: Ticket | null) => void;
  className?: string;
};

function Spinner() {
  return <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />;
}

export function RegistrationCard({
  eventId,
  ticket,
  ready,
  ended,
  going,
  onTicketChange,
  className,
}: RegistrationCardProps) {
  const [busy, setBusy] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState("");
  const nameId = useId();

  const requireAccount = useRequireAccount();

  async function register() {
    if (!requireAccount()) return;
    setBusy(true);
    try {
      const profile = await getMyProfile();
      if (!profile || !profile.fullName.trim()) {
        setNameOpen(true);
        return;
      }
      onTicketChange(await rsvpEvent(eventId));
    } catch {
      toast.error("Could not register. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fullName = name.trim();
    if (!fullName) return;
    setBusy(true);
    try {
      await saveMyProfile({ fullName });
      const next = await rsvpEvent(eventId);
      setNameOpen(false);
      onTicketChange(next);
    } catch {
      toast.error("Could not register. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await cancelRsvp(eventId);
      onTicketChange(null);
    } catch {
      toast.error("Could not cancel. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const goingLine = (
    <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
      {going} going
    </p>
  );

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <p className="border-b bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
        {ticket ? "Your ticket" : "Registration"}
      </p>
      {ticket ? (
        <CardContent className="flex flex-col items-center gap-4 p-4 text-center">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-balance">You&apos;re in</h2>
            {goingLine}
          </div>

          {/* Hidden once scanned, so the checked-in state is the thing you see. */}
          {!ticket.checkedInAt && <TicketQr code={ticket.code} size={220} />}

          {ticket.checkedInAt ? (
            <p className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground tabular-nums">
              <CircleCheck aria-hidden className="size-4" />
              Checked in at {formatTime(ticket.checkedInAt)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Show this at the door</p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <Link href="/tickets" className={buttonVariants({ variant: "link" })}>
              All my tickets
            </Link>
            {!ticket.checkedInAt && !ended && (
              <Button
                variant="link"
                className="text-muted-foreground hover:text-destructive"
                disabled={busy}
                onClick={cancel}
              >
                {busy && <Spinner />}
                {busy ? "Cancelling…" : "Cancel registration"}
              </Button>
            )}
          </div>
        </CardContent>
      ) : ended ? (
        <CardContent className="space-y-1 p-4">
          <h2 className="text-base font-semibold tracking-tight text-balance">
            This event has ended
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">{going} registered</p>
        </CardContent>
      ) : (
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-balance">
              Save your spot
            </h2>
            {goingLine}
          </div>
          <Button
            size="lg"
            className="h-10 w-full text-base"
            disabled={!ready || busy}
            onClick={register}
          >
            {(busy || !ready) && <Spinner />}
            {busy ? "Registering…" : "Register"}
          </Button>
        </CardContent>
      )}

      <Dialog open={nameOpen} onOpenChange={(open) => !busy && setNameOpen(open)}>
        <DialogContent>
          <form onSubmit={submitName} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>What is your name?</DialogTitle>
              <DialogDescription>Shown on the guest list.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={nameId}>Full name</Label>
              <Input
                id={nameId}
                name="name"
                autoComplete="name"
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || !name.trim()} className={cn("sm:min-w-28")}>
                {busy && <Spinner />}
                {busy ? "Registering…" : "Register"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
