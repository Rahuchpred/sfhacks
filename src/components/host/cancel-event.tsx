"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteEvent } from "@/lib/db";
import type { CampusEvent } from "@/lib/types";

const countFormat = new Intl.NumberFormat();

function consequence(going: number): string {
  if (going <= 0) {
    return "No one has registered yet. The event comes off the map. This cannot be undone.";
  }
  const who =
    going === 1
      ? "1 person registered. They will lose their ticket"
      : `${countFormat.format(going)} people registered. They will lose their tickets`;
  return `${who}, and the event comes off the map. This cannot be undone.`;
}

export function CancelEvent({ event }: { event: CampusEvent }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await deleteEvent(event.id);
      toast.success("Event canceled");
      router.replace("/host");
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "";
      setError(`Could not cancel the event. ${detail}`.trim());
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Stay open while the delete is in flight.
        if (pending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger render={<Button variant="destructive" size="lg" className="h-10 px-4" />}>
        Cancel event
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Cancel this event?</DialogTitle>
          <DialogDescription className="text-pretty tabular-nums">
            {consequence(event.rsvpCount)}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-pretty break-words text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            className="h-10 px-4"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Keep event
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="h-10 px-4"
            disabled={pending}
            onClick={confirm}
          >
            {pending && (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            )}
            <span aria-live="polite">{pending ? "Canceling…" : "Cancel event"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
