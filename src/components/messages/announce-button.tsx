"use client";

// Reference, from memory because the Mobbin tool was not connected in this
// session: Luma's "Send a blast" to guests (a small dialog with one text box
// and how many guests it reaches above the send button).

import { useState } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { messageError, sendAnnouncement } from "@/lib/db-messages";
import { cn } from "@/lib/utils";
import { refreshInbox } from "./use-inbox";
import { useEventMessaging } from "./use-event-messaging";

const MAX = 500;

function people(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

// For the event's team: one message to everyone registered, now or later.
export function AnnounceButton({ eventId, className }: { eventId: string; className?: string }) {
  const messaging = useEventMessaging(eventId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!messaging?.isTeam) return null;
  const audience = messaging.audience ?? 0;
  const body = text.trim();

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendAnnouncement(eventId, body);
      toast.success(audience > 0 ? `Sent to ${people(audience)}` : "Posted");
      setText("");
      setOpen(false);
      refreshInbox();
    } catch (sendError) {
      setError(messageError(sendError, "Could not send. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "h-10 animate-in px-4 duration-200 ease-out fade-in-0 motion-reduce:animate-none",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <Megaphone aria-hidden />
        Announce
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent>
          <form onSubmit={send} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Announcement</DialogTitle>
              <DialogDescription className="tabular-nums">
                {audience > 0
                  ? `Goes to ${people(audience)} registered, and anyone who registers later.`
                  : "Nobody is registered yet. People who register later will see it."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Textarea
                aria-label="Announcement"
                rows={3}
                maxLength={MAX}
                autoFocus
                placeholder="Room changed to Burk 336"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }}
                className="min-h-20"
              />
              <div className="flex justify-between gap-3 text-xs">
                <p role="alert" className="font-medium text-destructive">
                  {error}
                </p>
                {MAX - text.length <= 100 && (
                  <span className="text-muted-foreground tabular-nums">{MAX - text.length} left</span>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!body || busy} className="h-9 sm:min-w-28">
                {busy && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
                {busy ? "Sending" : "Send"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
