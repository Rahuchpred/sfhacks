"use client";

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

  async function register() {
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
    <Card className={className}>
      {ticket ? (
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-balance">You&apos;re in</h2>
            {goingLine}
          </div>

          <TicketQr code={ticket.code} size={180} />

          {ticket.checkedInAt ? (
            <p className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
              <CircleCheck aria-hidden className="size-4 text-primary" />
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
        <CardContent className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-balance">
            This event has ended
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">{going} registered</p>
        </CardContent>
      ) : (
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-balance">Registration</h2>
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
          <p className="text-xs text-muted-foreground">Free. You get a QR ticket for the door.</p>
        </CardContent>
      )}

      <Dialog open={nameOpen} onOpenChange={(open) => !busy && setNameOpen(open)}>
        <DialogContent>
          <form onSubmit={submitName} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>What is your name?</DialogTitle>
              <DialogDescription>
                The host sees it on the guest list when you check in.
              </DialogDescription>
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
